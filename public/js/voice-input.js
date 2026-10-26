/**
 * Web Speech API Voice Dictation Helper
 * Provides seamless spoken case descriptions & interrogation notes
 */

document.addEventListener('DOMContentLoaded', () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  document.querySelectorAll('.voice-dictate-btn').forEach(btn => {
    const targetSelector = btn.getAttribute('data-target');
    const targetInput = document.querySelector(targetSelector);
    if (!targetInput) return;

    if (!SpeechRecognition) {
      btn.title = 'Web Speech API is not supported in this browser. Please use Chrome/Edge.';
      btn.addEventListener('click', () => {
        alert('Web Speech API is not supported by your current browser. Voice dictation is fully supported in Chromium-based browsers (Chrome, Edge, Brave).');
      });
      return;
    }

    let recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let isRecording = false;

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        const currentVal = targetInput.value ? targetInput.value.trim() + ' ' : '';
        targetInput.value = currentVal + finalTranscript.trim();
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      isRecording = false;
      btn.classList.remove('recording');
      btn.innerHTML = '<i class="bi bi-mic"></i> Start Voice Dictation';
    };

    recognition.onend = () => {
      if (isRecording) {
        // Automatically restart if user hasn't explicitly stopped
        try {
          recognition.start();
        } catch (e) {
          isRecording = false;
          btn.classList.remove('recording');
          btn.innerHTML = '<i class="bi bi-mic"></i> Start Voice Dictation';
        }
      } else {
        btn.classList.remove('recording');
        btn.innerHTML = '<i class="bi bi-mic"></i> Start Voice Dictation';
      }
    };

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isRecording) {
        try {
          recognition.start();
          isRecording = true;
          btn.classList.add('recording');
          btn.innerHTML = '<i class="bi bi-record-circle"></i> Listening... (Click to Stop)';
        } catch (err) {
          console.error('Speech recognition start failed:', err);
        }
      } else {
        isRecording = false;
        recognition.stop();
        btn.classList.remove('recording');
        btn.innerHTML = '<i class="bi bi-mic"></i> Start Voice Dictation';
      }
    });
  });
});
