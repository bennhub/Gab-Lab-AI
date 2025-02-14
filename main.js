
            import { GoogleGenerativeAI } from '@google/generative-ai';
            import md from 'markdown-it';

            // Initialize Markdown
            const markdown = new md();

            // Variables
            let recognition = null;
            let isListening = false;
            let analysisInterval = null;
            let startTime = null;
            let wordCount = 0;
            let fillerWords = new Set(['um', 'uh', 'like', 'you know', 'sort of', 'kind of']);
            let fillerCount = 0;
            let lastTranscript = '';
            let accumulatedText = '';
            let currentFocus = 'all';
            let genAI = null;
            let model = null;
            let isValidKey = false;

            // Initialize speech recognition
            function initSpeechRecognition() {
                if (!('webkitSpeechRecognition' in window)) {
                    console.error('Speech recognition not supported');
                    showPriorityAlert('Speech recognition is not supported in this browser');
                    return;
                }

                recognition = new webkitSpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;

                recognition.onstart = () => {
                    console.log('Speech recognition started');
                    startTime = Date.now();
                    updateUI('start');
                    accumulatedText = '';
                    fillerCount = 0;
                    wordCount = 0;
                    updateFillerCount();
                };

                recognition.onend = () => {
                    console.log('Speech recognition ended');
                    if (isListening) {
                        recognition.start();
                    }
                };

                recognition.onresult = handleSpeechResult;

                recognition.onerror = (event) => {
                    console.error('Recognition error:', event.error);
                    showPriorityAlert(`Speech recognition error: ${event.error}`);
                };
            }

            // Handle speech results
            async function handleSpeechResult(event) {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                        accumulatedText += transcript + ' ';
                        analyzeContent(transcript);
                    } else {
                        interimTranscript += transcript;
                    }
                }

                updateLiveTranscription(finalTranscript, interimTranscript);
            }

            // Analyze content
            function analyzeContent(transcript) {
                const words = transcript.toLowerCase().split(' ');

                // Check for filler words
                words.forEach(word => {
                    if (fillerWords.has(word)) {
                        fillerCount++;
                        updateFillerCount();
                        showPriorityAlert('Watch for filler word: "' + word + '"');
                    }
                });

                // Calculate speaking pace
                const timeDiff = (Date.now() - startTime) / 1000 / 60; // minutes
                wordCount += words.length;
                const wpm = Math.round(wordCount / timeDiff);
                updatePace(wpm);
            }

            // Update functions
            function updateUI(state) {
                const startButton = document.getElementById('startButton');
                const stopButton = document.getElementById('stopButton');

                if (state === 'start') {
                    startButton.classList.add('hidden');
                    stopButton.classList.remove('hidden');
                    document.getElementById('priority-alerts').classList.add('hidden');
                } else {
                    startButton.classList.remove('hidden');
                    stopButton.classList.add('hidden');
                }
            }

            function updateLiveTranscription(final, interim) {
                const div = document.getElementById('live-transcription');
                if (!div) return;

                div.innerHTML = `
                <span class="text-black">${final}</span>
                <span class="text-gray-400">${interim}</span>
            `;
                div.scrollTop = div.scrollHeight;
            }

            function updatePace(wpm) {
                const paceMeter = document.getElementById('pace-meter');
                const paceFeedback = document.getElementById('pace-feedback');
                if (!paceMeter || !paceFeedback) return;

                paceMeter.textContent = `${wpm} WPM`;

                if (wpm > 160) {
                    paceFeedback.textContent = 'Try slowing down a bit';
                    showPriorityAlert('Speaking too fast - try to slow down');
                } else if (wpm < 120) {
                    paceFeedback.textContent = 'Could speed up slightly';
                } else {
                    paceFeedback.textContent = 'Good pace';
                }
            }

            function updateFillerCount() {
                const countElement = document.getElementById('filler-count');
                const feedback = document.getElementById('filler-feedback');
                if (!countElement || !feedback) return;

                countElement.textContent = fillerCount;
                feedback.textContent = fillerCount > 5 ? 'Try to reduce filler words' : 'Good control';
            }

            function showPriorityAlert(message) {
                const alertDiv = document.getElementById('priority-alerts');
                const messageDiv = document.getElementById('priority-message');
                if (!alertDiv || !messageDiv) return;

                messageDiv.textContent = message;
                alertDiv.classList.remove('hidden');

                setTimeout(() => {
                    alertDiv.classList.add('hidden');
                }, 3000);
            }

            function updateCoachFeedback(feedback) {
                const coachDiv = document.getElementById('coach-feedback');
                if (!coachDiv) return;

                const formattedFeedback = markdown.render(feedback);
                const timestamp = new Date().toLocaleTimeString();

                coachDiv.innerHTML += `
                <div class="mb-4 border-b pb-2">
                    <div class="text-xs text-gray-500">${timestamp}</div>
                    ${formattedFeedback}
                </div>
            `;

                coachDiv.scrollTop = coachDiv.scrollHeight;
            }

            // API Key Management
            async function initializeAI(apiKey) {
                try {
                    genAI = new GoogleGenerativeAI(apiKey);
                    model = genAI.getGenerativeModel({ model: 'gemini-pro' });

                    // Test the API key
                    const chat = await model.startChat();
                    await chat.sendMessage([{ text: "Hello" }]);

                    updateApiStatus('valid', 'API key validated successfully');
                    return true;
                } catch (error) {
                    console.error('Error initializing AI:', error);
                    updateApiStatus('invalid', 'Invalid API key or connection error');
                    return false;
                }
            }

            function updateApiStatus(status, message) {
                const indicator = document.getElementById('apiStatusIndicator');
                const statusText = document.getElementById('apiStatusText');
                const messageDiv = document.getElementById('apiKeyMessage');
                const validIcon = document.getElementById('apiKeyValidIcon');
                const invalidIcon = document.getElementById('apiKeyInvalidIcon');
                const startButton = document.getElementById('startButton');

                if (!indicator || !statusText || !messageDiv || !validIcon || !invalidIcon || !startButton) return;

                // Update status indicator
                indicator.className = 'inline-block w-2 h-2 rounded-full';
                statusText.className = 'ml-1';

                switch (status) {
                    case 'valid':
                        indicator.classList.add('bg-green-500');
                        statusText.textContent = 'Connected';
                        validIcon.classList.remove('hidden');
                        invalidIcon.classList.add('hidden');
                        startButton.disabled = false;
                        startButton.classList.remove('opacity-50');
                        isValidKey = true;
                        break;
                    case 'invalid':
                        indicator.classList.add('bg-red-500');
                        statusText.textContent = 'Error';
                        validIcon.classList.add('hidden');
                        invalidIcon.classList.remove('hidden');
                        startButton.disabled = true;
                        startButton.classList.add('opacity-50');
                        isValidKey = false;
                        break;
                    default:
                        indicator.classList.add('bg-gray-300');
                        statusText.textContent = 'Not Connected';
                        validIcon.classList.add('hidden');
                        invalidIcon.classList.add('hidden');
                        startButton.disabled = true;
                        startButton.classList.add('opacity-50');
                        isValidKey = false;
                }

                if (message) {
                    messageDiv.textContent = message;
                } else {
                    messageDiv.textContent = '';
                }
            }

            // AI Feedback Function
            async function getAIFeedback(transcript) {
                if (!isValidKey) {
                    updateApiStatus('invalid', 'Please provide a valid API key first');
                    return;
                }

                try {
                    let personality = `You are an expert speech coach. `;

                    switch (currentFocus) {
                        case 'pace':
                            personality += `Focus ONLY on speaking pace. Analyze if the speaker is too fast, too slow, or has good rhythm.`;
                            break;
                        case 'clarity':
                            personality += `Focus ONLY on clarity and enunciation.`;
                            break;
                        case 'fillers':
                            personality += `Focus ONLY on filler words and unnecessary pauses.`;
                            break;
                        case 'engagement':
                            personality += `Focus ONLY on engagement and energy level.`;
                            break;
                        case 'vocabulary':
                            personality += `Focus ONLY on vocabulary improvement. Suggest better word choices.`;
                            break;
                        case 'sentence':
                            personality += `Focus ONLY on sentence structure and flow.`;
                            break;
                        case 'phrases':
                            personality += `Focus ONLY on professional phrase improvements.`;
                            break;
                        default:
                            personality += `Provide comprehensive feedback on pace, clarity, fillers, engagement, and vocabulary.`;
                    }

                    const chat = await model.startChat({ history: [] });
                    const result = await chat.sendMessage([{
                        text: `${personality}\n\nTranscript: "${transcript}"`
                    }]);

                    return result.response.text();
                } catch (error) {
                    console.error("Error getting AI feedback:", error);
                    return "Unable to generate feedback at this moment.";
                }
            }

            function updateFilterButtons(newFocus) {
                const buttons = {
                    'all': document.getElementById('filter-all'),
                    'pace': document.getElementById('filter-pace'),
                    'clarity': document.getElementById('filter-clarity'),
                    'fillers': document.getElementById('filter-fillers'),
                    'engagement': document.getElementById('filter-engagement'),
                    'vocabulary': document.getElementById('filter-vocabulary'),
                    'sentence': document.getElementById('filter-sentence'),
                    'phrases': document.getElementById('filter-phrases')
                };

                Object.values(buttons).forEach(button => {
                    if (button) {
                        button.classList.remove('bg-blue-500', 'text-white');
                        button.classList.add('bg-gray-200', 'text-black');
                    }
                });

                const selectedButton = buttons[newFocus];
                if (selectedButton) {
                    selectedButton.classList.remove('bg-gray-200', 'text-black');
                    selectedButton.classList.add('bg-blue-500', 'text-white');
                    currentFocus = newFocus;
                }
            }

            // Setup functions
            function setupEventListeners() {
                // Save API Key
                document.getElementById('saveApiKey').addEventListener('click', async () => {
                    const apiKey = document.getElementById('apiKeyInput').value.trim();
                    if (apiKey) {
                        updateApiStatus('none', 'Validating API key...');
                        if (await initializeAI(apiKey)) {
                            localStorage.setItem('googleAiApiKey', apiKey);
                        }
                    } else {
                        updateApiStatus('invalid', 'Please enter an API key');
                    }
                });

                // Toggle API Key visibility
                document.getElementById('toggleApiKey').addEventListener('click', () => {
                    const input = document.getElementById('apiKeyInput');
                    input.type = input.type === 'password' ? 'text' : 'password';
                });

                // Clear API Key
                document.getElementById('clearApiKey').addEventListener('click', () => {
                    localStorage.removeItem('googleAiApiKey');
                    document.getElementById('apiKeyInput').value = '';
                    genAI = null;
                    model = null;
                    updateApiStatus('none');
                });

                // Filter buttons
                const filters = ['all', 'pace', 'clarity', 'fillers', 'engagement', 'vocabulary', 'sentence', 'phrases'];
                filters.forEach(filter => {
                    const button = document.getElementById(`filter-${filter}`);
                    if (button) {
                        button.addEventListener('click', () => updateFilterButtons(filter));
                    }
                });

                // Main control buttons
                document.getElementById('startButton').addEventListener('click', () => {
                    if (recognition && isValidKey) {
                        isListening = true;
                        recognition.start();
                    } else if (!isValidKey) {
                        showPriorityAlert('Please provide a valid API key first');
                    }
                });

                document.getElementById('stopButton').addEventListener('click', async () => {
                    if (recognition) {
                        isListening = false;
                        recognition.stop();
                        updateUI('stop');

                        if (accumulatedText.trim()) {
                            const feedback = await getAIFeedback(accumulatedText);
                            updateCoachFeedback(feedback);
                        }
                    }
                });

                document.getElementById('clearButton').addEventListener('click', () => {
                    document.getElementById('coach-feedback').innerHTML = '';
                    document.getElementById('live-transcription').innerHTML = '';
                    document.getElementById('pace-meter').textContent = '0 WPM';
                    document.getElementById('pace-feedback').textContent = '';
                    document.getElementById('filler-count').textContent = '0';
                    document.getElementById('filler-feedback').textContent = '';
                    fillerCount = 0;
                    wordCount = 0;
                });
            }

            // Initialize when page loads
            document.addEventListener('DOMContentLoaded', () => {
                initSpeechRecognition();
                setupEventListeners();

                const savedApiKey = localStorage.getItem('googleAiApiKey');
                if (savedApiKey) {
                    document.getElementById('apiKeyInput').value = savedApiKey;
                    initializeAI(savedApiKey);
                } else {
                    updateApiStatus('none');
                }
            });
    