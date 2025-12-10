import axios from 'axios';
import type { Client } from 'graphql-ws';
import { createClient } from 'graphql-ws';
import WebSocket from 'ws';
import { ApolloClient, InMemoryCache, ApolloLink, gql, NormalizedCacheObject,  } from '@apollo/client/core';
import { useQuery } from "@apollo/client";
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import TimeoutLink from 'apollo-link-timeout';
import { ca } from 'zod/v4/locales';

export class BBBGraphQl {
  private joinUrl: string;
  private cookies: string[] | undefined = undefined;
  private sessionToken: string | null = null;
  private host: string = '';
  private authToken: string = '';
  private userId: string = '';
  private apolloClient!: ApolloClient<NormalizedCacheObject>;
  private graphQlClient: Client | undefined = undefined;
  private muted: Boolean = true;
  private raiseHand: Boolean = false;

  constructor(joinUrl: string) {
    this.joinUrl = joinUrl;
  }

  public async connect(closeCallback: () => void) {
    if (!(await this.requestSessionToken())) {
      console.log('Failed to request session token.');
      return false;
    }
    console.log("Requested session token..");

    if (!(await this.initApolloClient())) {
      console.log('Failed to initialize Apollo Client.');
      return false;
    }
    console.log("Initialized apollo client..");

    if (!(await this.getAuthToken())) {
      console.log('Failed to retrieve the authToken.');
      return false;
    }
    console.log("Retrieved authToken..");

    if (!(await this.connectToGraphQL())) {
      console.log('Failed to connect to GraphQL.');
      return false;
    }
    console.log("Connected to graphQL..");

    this.initUserSettings();

    return true;
  }

  private async requestSessionToken(): Promise<boolean> {
    try {

      //console.log('Join link used:', this.joinUrl);

      const response = await axios.get(this.joinUrl, {
        withCredentials: true,
        maxRedirects: 0,
        validateStatus: function (status) {
          return status == 200 || status == 302;
        },
      });

      if (response.status === 302) {
        const redirectUrl = response.headers['location'];
        //console.log("Redirecting to: " + redirectUrl);
        const url = new URL(redirectUrl);

        this.sessionToken = url.searchParams.get('sessionToken');
        this.host = url.host;
        this.cookies = response.headers['set-cookie'];
        //console.log('cookies', this.cookies);

        if (!this.sessionToken) {
          //console.log('No session token found. Requesting again.');
          const response = await axios.get(redirectUrl, {
            withCredentials: true,
            maxRedirects: 0,
            validateStatus: function (status) {
              return status == 200 || status == 302;
            },
          });
          if (response.status === 302 || response.status === 200) {
            const urlWithSessionToken = new URL(response.headers['location']);
            //console.log("Url With Session Token: " + redirectUrl);
            this.sessionToken = urlWithSessionToken.searchParams.get('sessionToken');
            this.cookies = response.headers['set-cookie'];
            //console.log("Redirected twice. Session token: " + this.sessionToken);
            //console.log("Cookies: " + this.cookies);
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

    //await new Promise(resolve => setTimeout(resolve, 10000));

    const USER_CURRENT_QUERY = gql`
      query Patched_userCurrentSubscription {
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
      //console.log('IN getAuthToken: ', data);
      this.authToken = data.user_current[0].authToken;
      this.userId = data.user_current[0].userId;
      return true;
    }

    console.log("No data from USER_CURRENT_QUERY");

    return false;
  }

  public async connectToGraphQL() {

    console.log('--- Connecting to GraphQL... ---');


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
    //console.log('userJoin result:', result);

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
      //console.log('jSessionCookie', jSessionCookie);

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
            console.log('GraphQL-Client: Session token is invalid');
            return false;
          }
          console.log("Error in graphql client: ", error)
          return true;
        },
        on: {
          connecting: (isRetry) => {
            console.info('GraphQL-Client: Connecting to server, isRetry: ', isRetry);
          },
          opened: (socket) => {
            //console.info('GraphQL-Client: Connection opened, socket: ', socket);
            console.info('GraphQL-Client: Connection opened');
          },
          connected: (socket, payload, wasRetry) => {
            console.info("Connected to server");
            //console.info('GraphQL-Client: Connected to server, socket: ', socket, " payload: ", payload, " wasRetry: ", wasRetry);
          },
          ping: (payload) => {
            console.info('GraphQL-Client: Ping event', payload);
          },
          pong: () => {
            console.info('GraphQL-Client: Pong event');
          },
          message: (message) => {
            console.info('GraphQL-Client: Message received from server: ', message);
          },
          closed: () => {
            console.info('GraphQL-Client: Connection closed');
          },
          error: error => {
            console.error('GraphQL-Client: Error: on subscription to server:', error);
          },
        },
      });

      //console.log('graphQlClient: ', this.graphQlClient);

      const graphqlWsLink = new GraphQLWsLink(this.graphQlClient);

      wsLink = ApolloLink.from([graphqlWsLink]);

      //wsLink.setOnError(error => {
      //  throw new Error('Error: on apollo connection'.concat(JSON.stringify(error) || ''));
      //});

    } catch (error) {
      console.error('Error creating WebSocketLink: ', error);
      return false;
    }
    try {
      const timeoutLink = new TimeoutLink(10000);
      this.apolloClient = new ApolloClient({
        link: timeoutLink.concat(wsLink),
        //link: wsLink,
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

  public async becomePresenter() {
    const SET_PRESENTER_MUTATION = gql`
      mutation SetPresenter($userId: String!) {
        userSetPresenter(
          userId: $userId
        )
      }
    `;
    const result = await this.apolloClient.mutate({
      mutation: SET_PRESENTER_MUTATION,
      variables: {
        userId: this.userId,
      },
    });
    //console.log('userJoin result:', result);
  }

  public async toggleMute(newMutedState:boolean|undefined = undefined) {

    if (newMutedState !== undefined) {
      this.muted = !newMutedState;
    } else {
      newMutedState = !this.muted;
    }

    const SET_MUTED_MUTATION = gql`
      mutation SetMuted($userId: String, $muted: Boolean!) {
        userSetMuted(
          userId: $userId
          muted: $muted
        )
      }
    `;

    const result = await this.apolloClient.mutate({
      mutation: SET_MUTED_MUTATION,
      variables: {
        userId: this.userId,
        muted: newMutedState
      },
    });
    this.muted = newMutedState;
    //console.log('muted mutation result:', result);
    return this.muted;
  }

  public async toggleRaiseHand(newRaiseHandState:boolean|undefined = undefined) {

    //console.log("raise hand event: ", newRaiseHandState);

    if (newRaiseHandState !== undefined) {
      this.raiseHand = !newRaiseHandState;
    } else {
      newRaiseHandState = !this.raiseHand;
    }

    const SET_RAISE_HAND_MUTATION = gql`
    mutation SetRaiseHand($raiseHand: Boolean!, $userId: String) {
      userSetRaiseHand(
        raiseHand: $raiseHand
        userId: $userId
      )}
    `;

    //console.log("raising hand: ", newRaiseHandState);

    const result = await this.apolloClient.mutate({
      mutation: SET_RAISE_HAND_MUTATION,
      variables: {
        raiseHand: newRaiseHandState,
        userId: this.userId
      },
    });
    this.raiseHand = newRaiseHandState;
    //console.log('raiseHand mutation result:', result);
    return this.raiseHand;

  }

  // set the user initially as muted and become the presenter
  private initUserSettings() {
    this.toggleMute(true);
    this.becomePresenter();
  }

  public getUserId() {
    return this.userId;
  }
}
