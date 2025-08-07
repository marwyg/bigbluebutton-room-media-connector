<script setup lang="ts">
import type { Meeting } from '../../../main/src/ConfigManager';

defineProps<{
    meeting: Meeting
}>()
</script>


<template>
    <div class="meeting-card">
        <!-- <p v-if="meeting.name"> {{ meeting.name }} </p> -->
        <!-- <p v-if="meeting.description"> {{ meeting.description }} </p> -->
        <input type="text" class="general-input" v-model="meeting.link" />
    </div>
</template>


<style scoped>
.meeting-card {
    flex-grow: 1;
}
</style>
