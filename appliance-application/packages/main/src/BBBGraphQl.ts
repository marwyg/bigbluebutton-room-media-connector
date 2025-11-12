import axios from 'axios';
import type { Client } from 'graphql-ws';
import { createClient } from 'graphql-ws';
import WebSocket from 'ws';
import { ApolloClient, InMemoryCache, ApolloLink, gql, NormalizedCacheObject,  } from '@apollo/client/core';
import { useQuery } from "@apollo/client";
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';

export class BBBGraphQl {
  private joinUrl: string;
  private cookies: string[] | undefined = undefined;
  private sessionToken: string | null = null;
  private host: string = '';
  private authToken: string = '';
  private userId: string = '';
  private apolloClient: ApolloClient<NormalizedCacheObject> | undefined;
  private graphQlClient: Client | undefined = undefined;

  constructor(joinUrl: string) {
    this.joinUrl = joinUrl;
  }

  public async connect(closeCallback: () => void) {
    if (!(await this.requestSessionToken())) {
      console.error('Failed to request session token.');
      return false;
    }
    console.log("Requested session token..");

    if (!(await this.initApolloClient())) {
      console.error('Failed to initialize Apollo Client.');
      return false;
    }
    console.log("Initialized apollo client..");

    if (!(await this.getAuthToken())) {
      console.error('Failed to retrieve the authToken.');
      return false;
    }
    console.log("Retrieved authToken..");

    if (!(await this.connectToGraphQL())) {
      console.error('Failed to connect to GraphQL.');
      return false;
    }
    console.log("Connected to graphQL..");

    return true;
  }

  private async requestSessionToken(): Promise<boolean> {
    try {

      console.debug('Join link used:', this.joinUrl);

      const response = await axios.get(this.joinUrl, {
        withCredentials: true,
        maxRedirects: 0,
        validateStatus: function (status) {
          return status == 200 || status == 302;
        },
      });

      if (response.status === 302) {
        const redirectUrl = response.headers['location'];
        console.log("Redirecting to: " + redirectUrl);
        const url = new URL(redirectUrl);

        this.sessionToken = url.searchParams.get('sessionToken');
        this.host = url.host;
        this.cookies = response.headers['set-cookie'];
        console.debug('cookies', this.cookies);

        if (!this.sessionToken) {
          console.log('No session token found. Requesting again.');
          const response = await axios.get(redirectUrl, {
            withCredentials: true,
            maxRedirects: 0,
            validateStatus: function (status) {
              return status == 200 || status == 302;
            },
          });
          if (response.status === 302 || response.status === 200) {
            const urlWithSessionToken = new URL(response.headers['location']);
            console.log("Url With Session Token: " + redirectUrl);
            this.sessionToken = urlWithSessionToken.searchParams.get('sessionToken');
            this.cookies = response.headers['set-cookie'];
            console.log("Redirected twice. Session token: " + this.sessionToken);
            console.log("Cookies: " + this.cookies);
          }
          if (!this.sessionToken) {
            console.error('Failed to request session token.');
            return false;
          }
        }

        return true;
      }
    } catch (error) {
      console.error(error);
    }

    return false;
  }

  private async getAuthToken(): Promise<boolean> {

    if (!this?.apolloClient) {
      return false;
    }

    //console.log(this.apolloClient);

    const HEALTH_CHECK_QUERY = gql`
      query HealthCheck {
        __typename
      }
    `;

    console.log("Executing HEALTH_CHECK_QUERY..");

    try {

      this.apolloClient.query({
          query: HEALTH_CHECK_QUERY,
          errorPolicy: "none",
          fetchPolicy: 'network-only'
        });

    } catch (error) {
      console.error("Connection failed or query error:", error);
    }

    console.log("Connection check finished. Waiting 5s");


    await new Promise(resolve => setTimeout(resolve, 5000));

    const USER_CURRENT_QUERY = gql`
      query getUserCurrent {
        user_current {
          authToken
          userId
        }
      }
    `;

    console.log("Executing USER_CURRENT_QUERY..");

    const {data} = await this.apolloClient.query({
      query: USER_CURRENT_QUERY,
      fetchPolicy: 'network-only',
    });

    console.log("USER_CURRENT_QUERY executed..");

    if (data && data?.user_current?.[0]?.authToken) {
      console.log('IN getAuthToken: ', data);
      this.authToken = data.user_current[0].authToken;
      this.userId = data.user_current[0].userId;
      return true;
    }

    console.log("No data from USER_CURRENT_QUERY");

    return false;
  }

  public async connectToGraphQL() {

    console.debug('--- Connecting to GraphQL... ---');


    const JOIN_MUTATION = gql`
      mutation UserJoin($authToken: String!, $clientType: String!, $clientIsMobile: Boolean!) {
        userJoinMeeting(
          authToken: $authToken
          clientType: $clientType
          clientIsMobile: $clientIsMobile
        )
      }
    `;

    if (!this.authToken) {
      console.error('authToken is not set.');
      return false;
    }

    if (!this?.apolloClient) {
      console.error('apolloClient is not set.');
      return false;
    }

    // Execute the mutation
    const result = await this.apolloClient.mutate({
      mutation: JOIN_MUTATION,
      variables: {
        authToken: this.authToken,
        clientType: 'html5',
        clientIsMobile: false,
      },
    });

    // Check the result
    console.debug('userJoin result:', result);

    if (!result.data.userJoinMeeting) {
      console.log('userJoinMeeting failed');
      return false;
    }

    // wait for 500 ms-seconds
    await new Promise(resolve => setTimeout(resolve, 500));

    return true;
  }

  public async getJoinURL(params: object) {

    return await axios.get(`https://${this.host}/bigbluebutton/api/getJoinUrl`, {
      withCredentials: true,
      headers: {
        Cookie: this.cookies,
      },
      params: {
        sessionToken: this.sessionToken,
        ...params,
      },
    });

  }

  private async initApolloClient(): Promise<boolean> {
    let wsLink;
    try {
      // Check if cookies are not null before attempting to find a cookie
      if (!this.cookies) {
       console.error('Cookies are not set.');
       return false;
     }

      const jSessionCookie = this.cookies
       ?.find(cookie => cookie.startsWith('JSESSIONID'))
       ?.split(';')[0];
      console.debug('jSessionCookie', jSessionCookie);

      // You need to override the WebSocket class to add the cookie
      class WebSocketWithCookie extends WebSocket {
        constructor(address: string, protocols?: string | string[]) {
          super(address, protocols, {
            headers: {
              Cookie: jSessionCookie,
            },
          });
        }
      }

      // console.log("Creating graphql client with host: ", this.host);

      this.graphQlClient = createClient({
        url: `wss://${this.host}/graphql`,
        keepAlive: 10000,
        webSocketImpl: WebSocketWithCookie, // Pass the custom WebSocket class
        connectionParams: {
          headers: {
            'X-Session-Token': this.sessionToken,
            'X-ClientSessionUUID': '1234',
            'X-ClientType': 'HTML5',
            'X-ClientIsMobile': 'false',
          },
        },
        shouldRetry: (error: any) => {
          if (error.code === 4403) {
            console.error('GraphQL-Client: Session token is invalid');
            return false;
          }
          // console.log("Error in graphql client: ", error)
          return true;
        },
        on: {
          connecting: (isRetry) => {
            // console.info('GraphQL-Client: Connecting to server, isRetry: ', isRetry);
          },
          opened: (socket) => {
            //console.info('GraphQL-Client: Connection opened, socket: ', socket);
            // console.info('GraphQL-Client: Connection opened');
          },
          connected: (socket, payload, wasRetry) => {
            // console.info("Connected to server");
            //console.info('GraphQL-Client: Connected to server, socket: ', socket, " payload: ", payload, " wasRetry: ", wasRetry);
          },
          ping: (payload) => {
            //console.info('GraphQL-Client: Ping received from server');
          },
          pong: () => {
            //console.info('GraphQL-Client: Pong received from server');
          },
          message: (message) => {
            //console.info('GraphQL-Client: Message received from server: ', message);
          },
          closed: () => {
            // console.info('GraphQL-Client: Connection closed');
          },
          error: error => {
            console.error('GraphQL-Client: Error: on subscription to server:', error);
          },
        },
      });

      // console.log('graphQlClient: ', this.graphQlClient);

      const graphqlWsLink = new GraphQLWsLink(this.graphQlClient);

      wsLink = ApolloLink.from([graphqlWsLink]);

      wsLink.setOnError(error => {
        throw new Error('Error: on apollo connection'.concat(JSON.stringify(error) || ''));
      });

    } catch (error) {
      console.error('Error creating WebSocketLink: ', error);
      return false;
    }
    try {
      this.apolloClient = new ApolloClient({
        link: wsLink,
        cache: new InMemoryCache(),
      });

    } catch (error) {
      console.error('Error creating Apollo Client: ', error);
      return false;
    }
    return true;
  }

  public getApolloClient() {
    return this.apolloClient;
  }

  public async leaveMeeting() {
    console.log('--- Leaving meeting... ---');
    if (this.apolloClient) {
      await this.apolloClient.clearStore();
      this.apolloClient.stop();
      if (this.graphQlClient) {
        this.graphQlClient.dispose();
      }
    }
  }

  public getUserId() {
    return this.userId;
  }
}
