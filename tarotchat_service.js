let socket;
let authToken;
let userEmail;
let userDisplayName;
let userId;
let currentSessionId;
let isWaitingForResponse = false;
let isInputFocused = false;


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
        updateProfileButton();
        displayWelcomeMessage();
    } else {
        console.error('Missing user info');
        document.getElementById('userDetails').textContent = 'Error: User not authenticated';
    }

    document.getElementById('logoutButton').style.display = 'inline-block';
}

function updateUserInfo() {
    document.getElementById('userDetails').textContent = `${userDisplayName} (${userEmail})`;
}

function displayWelcomeMessage() {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = '<div class="message ai-message"><div class="message-content">어떤 이야기를 하고 싶나요?</div></div>';
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
        
        const sessionName = document.createElement('span');
        sessionName.textContent = session.SessionName;
        sessionName.onclick = () => loadSession(session.SessionId);
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'D';
        deleteButton.onclick = (e) => {
            e.stopPropagation(); // 세션 로드 방지
            deleteSession(session.SessionId);
        };
        
        sessionElement.appendChild(sessionName);
        sessionElement.appendChild(deleteButton);
        sessionElement.setAttribute('data-session-id', session.SessionId);
        
        if (session.SessionId === currentSessionId) {
            sessionElement.classList.add('active');
        }
        
        sessionList.appendChild(sessionElement);
    });
}

function updateProfileButton() {
    const profileButton = document.getElementById('ProfileBtn');
    if (profileButton && userDisplayName) {
        profileButton.textContent = userDisplayName.charAt(0).toUpperCase();
    }
}

function displayMessages(messages) {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = '';
    messages.forEach((message, index) => {
        const role = message.type === 'human' ? 'user' : 'ai';
        let content = message.content;
        if (content) {
            appendMessage(role, content);
            
            // 사용자 메시지 다음에 AI 인디케이터 추가 (마지막 메시지가 아닌 경우)
            if (role === 'user' && index < messages.length - 1 && messages[index + 1].type !== 'human') {
                const aiIndicator = document.createElement('div');
                aiIndicator.className = 'ai-indicator';
                aiIndicator.textContent = '*';
                chatBox.insertBefore(aiIndicator, chatBox.firstChild);
            }
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

        if (messages.length === 0) {
            displayWelcomeMessage(); // 메시지가 없는 경우 웰컴 메시지 표시
        } else {
            displayMessages(messages);
        }
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

function disableInput() {
    document.getElementById('messageInput').disabled = true;
    document.getElementById('SendButton').disabled = true;
    isWaitingForResponse = true;
}

function enableInput() {
    document.getElementById('messageInput').disabled = false;
    document.getElementById('SendButton').disabled = false;
    isWaitingForResponse = false;
}

function updateInputAreaStyle() {
    const messageInput = document.getElementById('messageInput');
    const inputArea = document.getElementById('inputArea');
    const sendButton = document.getElementById('SendButton');

    if (messageInput.value.trim() === '') {
        sendButton.classList.add('disabled');
        sendButton.disabled = true;
        
        if (!isInputFocused) {
            inputArea.classList.add('disabled');
        } else {
            inputArea.classList.remove('disabled');
        }
    } else {
        inputArea.classList.remove('disabled');
        sendButton.classList.remove('disabled');
        sendButton.disabled = false;
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (message && !isWaitingForResponse) {
        disableInput();
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
            if (initialMessage) {
                setTimeout(() => {
                    sendMessageToCurrentSession(initialMessage);
                }, 500);
            }
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
    
    // AI 인디케이터 추가 (사용자 메시지 다음에 오는 경우)
    if (sender === 'user') {
        const spacerElement = document.createElement('div');
        spacerElement.className = 'message-spacer';
        
        const aiIndicator = document.createElement('div');
        aiIndicator.className = 'ai-indicator';
        aiIndicator.textContent = '*';
        
        spacerElement.appendChild(aiIndicator);
        
        chatBox.insertBefore(spacerElement, chatBox.firstChild);
    } else if (sender === 'ai') {
        // AI 메시지인 경우, 이전에 추가된 spacer와 indicator를 제거
        const previousSpacer = chatBox.querySelector('.message-spacer');
        if (previousSpacer) {
            chatBox.removeChild(previousSpacer);
        }
    }
    
    chatBox.insertBefore(messageElement, chatBox.firstChild);
    scrollToBottom();
}

function scrollToBottom() {
    const chatBox = document.getElementById('chatBox');
    chatBox.scrollTop = chatBox.scrollHeight;
}

function handleIncomingMessage(data) {
    if (data.type === 'stream') {
        const content = extractContent(data.content);
        const lastMessage = document.querySelector('.message:first-child');
        const spacer = document.querySelector('.message-spacer');
        
        if (lastMessage && lastMessage.classList.contains('ai-message')) {
            lastMessage.querySelector('.message-content').innerHTML += content.replace(/\n/g, '<br>');
        } else {
            appendMessage('ai', content);
        }

        // AI 메시지가 시작되면 spacer 제거
        if (spacer) {
            spacer.remove();
        }

        scrollToBottom();
    } else if (data.type === 'end') {
        console.log('Stream ended');
        scrollToBottom();
        enableInput();
    } else if (data.type === 'error') {
        console.error('Error:', data.message);
        enableInput();
    } else if (data.type === 'session_name_update') {
        updateSessionName(data.name);
    }
}

// 세션 이름 업데이트
function updateSessionName(newName) {
    const sessionElement = document.querySelector(`.session-item[data-session-id="${currentSessionId}"]`);
    if (sessionElement) {
        const sessionNameSpan = sessionElement.querySelector('span');
        if (sessionNameSpan) {
            sessionNameSpan.textContent = newName;
        }
    }
}

async function startNewChat() {
    currentSessionId = null;
    document.getElementById('chatBox').innerHTML = '';
    displayWelcomeMessage();
    await createAndConnectNewSession('');
}

async function deleteSession(sessionId) {
    if (!confirm('정말로 이 세션을 삭제하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/sessions/${sessionId}?userId=${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': authToken }
        });

        if (response.ok) {
            console.log('Session deleted successfully');
            fetchSessions(); // 세션 목록 새로고침
            if (currentSessionId === sessionId) {
                currentSessionId = null;
                document.getElementById('chatBox').innerHTML = '';
            }
        } else {
            console.error('Error deleting session:', await response.text());
        }
    } catch (error) {
        console.error('Error deleting session:', error);
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

document.addEventListener('DOMContentLoaded', function() {
    const settingsmodal = document.getElementById("settingsModal");
    const settingsBtn = document.getElementById("Settings");
    const settingsspan = document.getElementsByClassName("settingsclose")[0];
    settingsBtn.onclick = function() {
        settingsmodal.style.display = "block";
    }
    settingsspan.onclick = function() {
        settingsmodal.style.display = "none";
    }
    window.onclick = function(event) {
        if (event.target == settingsmodal) {
            settingsmodal.style.display = "none";
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const profilemodal = document.getElementById("profileModal");
    const profileBtn = document.getElementById("ProfileBtn");
    const profilespan = document.getElementsByClassName("profileclose")[0];
    profileBtn.onclick = function() {
        profilemodal.style.display = "block";
    }
    profilespan.onclick = function() {
        profilemodal.style.display = "none";
    }
    window.onclick = function(event) {
        if (event.target == profilemodal) {
            profilemodal.style.display = "none";
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('SendButton');

    messageInput.addEventListener('input', updateInputAreaStyle);
    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('focus', () => {
        isInputFocused = true;
        updateInputAreaStyle();
    });

    messageInput.addEventListener('blur', () => {
        isInputFocused = false;
        updateInputAreaStyle();
    });

    // 초기 상태 설정
    updateInputAreaStyle();
});


document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const collapsedSidebar = document.getElementById('collapsedSidebar');
    const collapseBtn = document.getElementById('collapseBtn');
    const expandBtn = document.getElementById('expandBtn');
    const collapsedNewChatBtn = document.getElementById('collapsedNewChatBtn');
    const collapsedSettingsBtn = document.getElementById('collapsedSettingsBtn');
  
    function collapseSidebar() {
      sidebar.style.display = 'none';
      collapsedSidebar.style.display = 'flex';
    }
  
    function expandSidebar() {
      sidebar.style.display = 'flex';
      collapsedSidebar.style.display = 'none';
    }
  
    collapseBtn.addEventListener('click', collapseSidebar);
    expandBtn.addEventListener('click', expandSidebar);
  
    collapsedNewChatBtn.addEventListener('click', function() {
      startNewChat();
    });
  
    collapsedSettingsBtn.addEventListener('click', function() {
      document.getElementById('Settings').click();
    });
  });