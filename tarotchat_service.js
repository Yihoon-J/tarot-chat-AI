let socket;
let authToken;
let userEmail;
let userDisplayName;
let userId;
let currentSessionId;

const API_URL = 'https://blgg29wto5.execute-api.us-east-1.amazonaws.com/product';
const WS_URL = 'wss://tt0ikgb3sd.execute-api.us-east-1.amazonaws.com/production';

function initializePage() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    authToken = params.get('id_token');
    userEmail = decodeURIComponent(params.get('user_email') || '');
    userDisplayName = decodeURIComponent(params.get('user_nickname') || '');
    userId = params.get('sub');

    if (authToken && userEmail && userDisplayName && userId) {
        updateUserInfo();
        fetchSessions();
    } else {
        console.error('Missing user info');
        document.getElementById('userDetails').textContent = 'Error: User not authenticated';
    }

    document.getElementById('logoutButton').style.display = 'inline-block';
}

function updateUserInfo() {
    document.getElementById('userDetails').textContent = `${userDisplayName} (${userEmail})`;
}

async function fetchSessions() {
    try {
        const response = await fetch(`${API_URL}/sessions?userId=${userId}`, {
            headers: { 'Authorization': authToken }
        });
        const sessions = await response.json();
        displaySessions(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
    }
}

function displaySessions(sessions) {
    const sessionList = document.getElementById('sessionList');
    sessionList.innerHTML = '';
    sessions.forEach(session => {
        const sessionElement = document.createElement('div');
        sessionElement.className = 'session-item';
        sessionElement.textContent = session.SessionName;
        sessionElement.onclick = () => loadSession(session.SessionId);
        sessionList.appendChild(sessionElement);
    });
}

function displayMessages(messages) {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = '';
    messages.forEach(message => {
        const role = message.type === 'human' ? 'user' : 'ai';
        let content = message.content;
        if (content) {
            appendMessage(role, content);
        }
    });
}

function extractContent(contentData) {
    if (typeof contentData === 'string') {
        return contentData;
    } else if (typeof contentData === 'object' && contentData !== null) {
        return contentData.content || JSON.stringify(contentData);
    }
    return JSON.stringify(contentData);
}

async function loadSession(sessionId) {
    currentSessionId = sessionId;
    try {
        const response = await fetch(`${API_URL}/sessions/${sessionId}?userId=${userId}`, {
            headers: { 'Authorization': authToken }
        });
        const messages = await response.json();
        console.log('API Response:', messages);
        
        if (!Array.isArray(messages)) {
            console.error('Unexpected response format. Expected an array, got:', typeof messages);
            return;
        }

        displayMessages(messages);
        connectWebSocket();
    } catch (error) {
        console.error('Error loading session:', error);
    }
}

function connectWebSocket() {
    if (socket) {
        socket.close();
    }
    
    const wsUrl = `${WS_URL}?userId=${encodeURIComponent(userId)}&sessionId=${currentSessionId}`;
    socket = new WebSocket(wsUrl);

    socket.onopen = function(event) {
        console.log('WebSocket connected');
        console.log('Current Session ID:', currentSessionId);
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleIncomingMessage(data);
    };

    socket.onclose = function(event) {
        console.log('WebSocket closed. Code:', event.code, 'Reason:', event.reason);
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (message && currentSessionId) {
        appendMessage('user', message);
        const payload = {
            action: 'sendMessage',
            message: message,
            userId: userId,
            sessionId: currentSessionId
        };
        socket.send(JSON.stringify(payload));
        messageInput.value = '';
    }
}

function appendMessage(sender, message) {
    const chatBox = document.getElementById('chatBox');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    contentElement.innerHTML = message.replace(/\n/g, '<br>');
    
    messageElement.appendChild(contentElement);
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function handleIncomingMessage(data) {
    if (data.type === 'stream') {
        appendMessage('ai', extractContent(data.content));
    } else if (data.type === 'end') {
        console.log('Stream ended');
    } else if (data.type === 'error') {
        console.error('Error:', data.message);
    }
}

async function startNewChat() {
    try {
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken
            },
            body: JSON.stringify({ userId: userId })
        });
        const result = await response.json();
        console.log('New session result:', result);  // 디버깅을 위한 로그 추가
        if (response.ok) {
            currentSessionId = result.sessionId;
            connectWebSocket();
            document.getElementById('chatBox').innerHTML = '';
            fetchSessions();  // Refresh the session list
            
            if (result.welcomeMessage) {
                console.log('Welcome message:', result.welcomeMessage);
                // 웰컴 메시지 표시에 1초의 지연 추가
                setTimeout(() => {
                    appendMessage('ai', result.welcomeMessage);
                }, 200);
            } else {
                console.log('No welcome message in the response');
            }
        } else {
            console.error('Error creating new session:', result.error);
        }
    } catch (error) {
        console.error('Error creating new session:', error);
    }
}

function logout() {
    authToken = null;
    userEmail = null;
    userDisplayName = null;
    userId = null;
    currentSessionId = null;
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    
    document.getElementById('chatBox').innerHTML = '';
    document.getElementById('sessionList').innerHTML = '';
    document.getElementById('userDetails').textContent = 'Not logged in';
    
    window.location.href = 'http://localhost:3000/';
}

document.getElementById('messageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Initialize the page when the script loads
document.addEventListener('DOMContentLoaded', initializePage);

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
});