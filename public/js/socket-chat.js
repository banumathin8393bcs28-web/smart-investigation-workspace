/**
 * Socket.IO Real-time Collaboration & Case Messaging
 */

document.addEventListener('DOMContentLoaded', () => {
  const chatMessagesList = document.getElementById('chat-messages-list');
  const chatForm = document.getElementById('chat-send-form');
  const messageInput = document.getElementById('chat-input-text');
  const activeRoomInput = document.getElementById('active-room-name');

  if (!chatMessagesList || !chatForm) return;

  const socket = io();

  const currentRoom = activeRoomInput ? activeRoomInput.value : 'general';
  socket.emit('join_room', { room: currentRoom });

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
  };
  scrollToBottom();

  // Handle incoming message
  socket.on('receive_message', (data) => {
    const isMe = data.senderId === window.CURRENT_USER_ID;
    const msgDiv = document.createElement('div');
    msgDiv.className = `d-flex mb-3 ${isMe ? 'justify-content-end' : 'justify-content-start'}`;

    let evidenceHtml = '';
    if (data.evidenceObj) {
      evidenceHtml = `
        <div class="mt-2 p-2 rounded bg-black border border-secondary" style="font-size: 0.88rem;">
          <div class="text-info fw-bold"><i class="bi bi-shield-check"></i> Shared Evidence: ${data.evidenceObj.evidenceNumber}</div>
          <div class="text-white text-truncate">${data.evidenceObj.title}</div>
          <a href="/evidence/${data.evidenceObj._id}" class="badge badge-open mt-1 text-decoration-none">Inspect Item</a>
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div style="max-width: 75%; background-color: ${isMe ? '#1e3a8a' : '#1e293b'}; border: 1px solid ${isMe ? '#3b82f6' : '#334155'}; border-radius: 12px; padding: 12px 16px;">
        <div class="d-flex justify-content-between align-items-center mb-1" style="font-size: 0.8rem; color: #94a3b8;">
          <span class="fw-bold text-white">${data.senderName} (${data.senderBadge || 'INV'})</span>
          <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="text-white" style="font-size: 0.98rem; word-break: break-word;">${data.content}</div>
        ${evidenceHtml}
      </div>
    `;

    chatMessagesList.appendChild(msgDiv);
    scrollToBottom();
  });

  // Handle send form submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const evidenceShareSelect = document.getElementById('evidence-share-select');
    const evidenceShare = evidenceShareSelect ? evidenceShareSelect.value : null;

    const payload = {
      room: currentRoom,
      content,
      caseId: window.CURRENT_CASE_ID || null,
      recipientId: window.CURRENT_RECIPIENT_ID || null,
      evidenceShare: evidenceShare || null,
      senderId: window.CURRENT_USER_ID,
      senderName: window.CURRENT_USER_NAME,
      senderBadge: window.CURRENT_USER_BADGE
    };

    socket.emit('send_message', payload);
    messageInput.value = '';
    if (evidenceShareSelect) evidenceShareSelect.value = '';
  });
});
