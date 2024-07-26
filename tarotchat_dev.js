let socket;

function connectWebSocket() {
    socket = new WebSocket('wss://tt0ikgb3sd.execute-api.us-east-1.amazonaws.com/production/');

    socket.onopen = function(event) {
        console.log('WebSocket connected');
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
        }
    };

    socket.onclose = function(event) {
        console.log('WebSocket closed. Reconnecting...');
        setTimeout(connectWebSocket, 3000);
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
            message: message
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

// Connect to WebSocket when the page loads
connectWebSocket();

// Allow sending messages with Enter key
document.getElementById('messageInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevent default to avoid newline in input
        sendMessage();
    }
});