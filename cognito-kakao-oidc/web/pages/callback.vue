<template>
  <div>Redirecting...</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const authStore = useAuthStore()

onMounted(() => {
  if (route.hash) {
    const params = new URLSearchParams(route.hash.slice(1))
    const idToken = params.get('id_token')
    if (idToken) {
      authStore.setAccessToken(idToken)
      // Redirect to tarot.html on port 3001 with the token
      window.location.href = `http://localhost:3001/tarot.html#id_token=${idToken}`
    } else {
      console.error('No id_token found in the callback URL')
      // Handle error - maybe redirect to login page
    }
  } else {
    console.error('No hash found in the callback URL')
    // Handle error - maybe redirect to login page
  }
})
</script>