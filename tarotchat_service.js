let socket;
let authToken;
let userEmail;
let userDisplayName;
let userId;

function initializePage() {
    const hash = window.location.hash.substring(1);
    console.log('Full URL hash:', hash);
    const params = new URLSearchParams(hash);
    authToken = params.get('id_token');
    userEmail = decodeURIComponent(params.get('user_email') || '');
    userDisplayName = decodeURIComponent(params.get('user_nickname') || '');
    userId = params.get('sub');

    console.log('Parsed parameters:', {
        authToken: authToken ? 'exists' : 'missing',
        userEmail,
        userDisplayName,
        userId
    });

    if (authToken && userEmail && userDisplayName && userId) {
        updateUserInfo();
        initializeWebSocket(authToken);
    } else {
        console.error('Missing info');
        // Show an error message or redirect to login page
        document.getElementById('userDetails').textContent = 'Error: User not authenticated';
    }

    // Always ensure the logout button is visible
    document.getElementById('logoutButton').style.display = 'inline-block';
}

function updateUserInfo() {
    document.getElementById('userDetails').textContent = `${userDisplayName} (${userEmail})`;
}

function initializeWebSocket(token) {
    authToken = token;
    connectWebSocket();
}

function connectWebSocket() {
    if (!userId) {
        console.error('userId is not set. Cannot connect to WebSocket.');
        return;
    }

    const wsUrl = `wss://tt0ikgb3sd.execute-api.us-east-1.amazonaws.com/production/?userId=${encodeURIComponent(userId)}`;
    console.log('Connecting to WebSocket:', wsUrl); // 디버깅을 위한 로그 추가
    socket = new WebSocket(wsUrl);

    socket.onopen = function(event) {
        console.log('WebSocket connected');
        // Send the auth token immediately after connection
        const authMessage = {
            action: 'authenticate',
            token: authToken,
            userId: userId
        };
        console.log('Sending auth message:', authMessage);
        socket.send(JSON.stringify(authMessage));
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'stream') {
            const content = data.content;
            const match = content.match(/^\('([^']+)',\s*(.+)\)$/);
            if (match) {
                const [, key, value] = match;
                if (key === 'content') {
                    const cleanedValue = value.replace(/^"|"$/g, '').replace(/\\"/g, '"').replace(/\\n/g, '\n');
                    appendMessage('AI', cleanedValue);
                }
            }
        } else if (data.type === 'end') {
            console.log('Stream ended');
        } else if (data.type === 'error') {
            console.error('Error:', data.message);
            // Handle authentication errors here
            if (data.message === 'Authentication failed') {
                // Show an error message or redirect to login page
                document.getElementById('userDetails').textContent = 'Error: Authentication failed';
            }
        }
    };

    socket.onclose = function(event) {
        console.log('WebSocket closed. Reconnecting...');
        console.log('Code:', event.code, 'Reason:', event.reason);
        setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (message) {
        appendMessage('You', message);
        const payload = {
            action: 'sendMessage',
            message: message,
            userId: userId // userId 추가
        };
        socket.send(JSON.stringify(payload));
        messageInput.value = '';
    }
}

function appendMessage(sender, message) {
    const chatBox = document.getElementById('chatBox');
    const messageElement = document.createElement('p');
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message.replace(/\n/g, '<br>')}`;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function logout() {
    // Clear any stored auth data
    authToken = null;
    userEmail = null;
    userDisplayName = null;
    
    // Close WebSocket if it's open
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    
    // Clear the chat box
    document.getElementById('chatBox').innerHTML = '';
    
    // Update user info to show logged out state
    document.getElementById('userDetails').textContent = 'Not logged in';
    
    // Redirect to the main login page
    window.location.href = 'http://localhost:3000/';
}

// Initialize the page when the script loads
document.addEventListener('DOMContentLoaded', initializePage);

// Allow sending messages with Enter key
document.getElementById('messageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevent default to avoid newline in input
        sendMessage();
    }
});