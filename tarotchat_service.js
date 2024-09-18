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
        sessionElement.setAttribute('data-session-id', session.SessionId);
        if (session.SessionId === currentSessionId) {
            sessionElement.classList.add('active');
        }
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
    // Remove 'active' class from previously active session
    const previousActive = document.querySelector('.session-item.active');
    if (previousActive) {
        previousActive.classList.remove('active');
    }
    
    // Add 'active' class to newly selected session
    const newActive = document.querySelector(`.session-item[data-session-id="${sessionId}"]`);
    if (newActive) {
        newActive.classList.add('active');
    }

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
    return new Promise((resolve, reject) => {
        if (socket) {
            socket.close();
        }
        
        const wsUrl = `${WS_URL}?userId=${encodeURIComponent(userId)}&sessionId=${currentSessionId}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = function(event) {
            console.log('WebSocket connected');
            console.log('Current Session ID:', currentSessionId);
            resolve();
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
            reject(error);
        };
    });
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (message) {
        if (!currentSessionId) {
            await createAndConnectNewSession(message);
        } else {
            sendMessageToCurrentSession(message);
        }
        messageInput.value = '';
    }
}

// 세션 생성과 연결 동시에 수행
async function createAndConnectNewSession(initialMessage) {
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
        
        if (response.ok) {
            currentSessionId = result.sessionId;
            await connectWebSocket();
            document.getElementById('chatBox').innerHTML = '';
            fetchSessions();

            if (result.welcomeMessage) {
                appendMessage('ai', result.welcomeMessage);
            }

            // Send the initial message after a short delay
            setTimeout(() => {
                sendMessageToCurrentSession(initialMessage);
            }, 500);
        } else {
            console.error('Error creating new session:', result.error);
        }
    } catch (error) {
        console.error('Error creating new session:', error);
    }
}

// 현재 세션에 메시지 전송
function sendMessageToCurrentSession(message) {
    appendMessage('user', message);
    const payload = {
        action: 'sendMessage',
        message: message,
        userId: userId,
        sessionId: currentSessionId
    };
    socket.send(JSON.stringify(payload));
}

function appendMessage(sender, message) {
    const chatBox = document.getElementById('chatBox');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    contentElement.innerHTML = message.replace(/\n/g, '<br>');
    
    messageElement.appendChild(contentElement);
    chatBox.insertBefore(messageElement, chatBox.firstChild);
    scrollToBottom()
}

function scrollToBottom() {
    const chatBox = document.getElementById('chatBox');
    chatBox.scrollTop = chatBox.scrollHeight;
}

function handleIncomingMessage(data) {
    if (data.type === 'stream') {
        appendMessage('ai', extractContent(data.content));
    } else if (data.type === 'end') {
        console.log('Stream ended');
        scrollToBottom();
    } else if (data.type === 'error') {
        console.error('Error:', data.message);
    }
}

async function startNewChat() {
    await createAndConnectNewSession('');
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