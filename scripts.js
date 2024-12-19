const { createApp, ref, reactive, computed } = Vue;

function createPartialWordHTML(word, revealedLetters) {
    return word.split('').map((letter, index) => {
        const isRevealed = revealedLetters.has(index);
        return `<input type="text" 
            class="letter-input ${isRevealed ? 'revealed' : ''}" 
            value="${isRevealed ? letter : ''}" 
            data-index="${index}"
            ${isRevealed ? 'disabled' : ''}>`;
    }).join('');
}

const app = createApp({
    setup() {
        // Reactive state variables
        const words = ref([]);
        const currentWord = reactive({ word: '', definition: '' });
        const userInput = ref([]);
        const revealedLetters = ref(new Set());
        const revealCount = ref(0);
        const guessCount = ref(0);
        const message = ref('');
        const messageType = ref('');
        const partialWord = computed(() => createPartialWordHTML(currentWord.word, revealedLetters.value));
        const resultsText = ref('');
        const showModal = ref(false);
        const showAboutModal = ref(false);

        // Computed properties
        const allFilled = computed(() => {
            return [...currentWord.word].every((_, index) => {
                return revealedLetters.value.has(index) || (userInput.value[index] !== undefined);
            });
        });

        const remainingLetters = computed(() => {
            return currentWord.word.length - revealedLetters.value.size;
        });

        // Load a new word
        const loadNewWord = async () => {
            try {
                const response = await fetch('/api/words');
                const data = await response.json();
                
                message.value = '';
                currentWord.word = data.word;
                currentWord.definition = data.definition;
                revealedLetters.value = new Set();
                userInput.value = new Array(currentWord.word.length);
                revealCount.value = 0;
                guessCount.value = 0;
                showModal.value = false;
            } catch (error) {
                console.error('Error loading word:', error);
            }
        };

        // Handle virtual keyboard key press
        const handleVirtualKeyPress = (key) => {
            if (key === 'Backspace') {
                handleBackspace();
            } else if (key === 'Enter') {
                if (allFilled.value) {
                    checkWord();
                }
            } else if (/^[a-z]$/.test(key)) {
                handleLetterInput(key);
            }
        };

        // Handle backspace key press
        const handleBackspace = () => {
            const lastFilledInput = [...document.querySelectorAll('.letter-input:not([disabled])')].reverse()
                .find(input => input.value !== '');
            
            if (lastFilledInput) {
                const index = parseInt(lastFilledInput.dataset.index);
                lastFilledInput.value = '';
                userInput.value[index] = undefined;
                lastFilledInput.focus();
                updateSubmitButton();
            }
        };

        // Handle letter input
        const handleLetterInput = (key) => {
            // Find first empty position in userInput array that isn't revealed
            const index = userInput.value.findIndex((val, idx) => 
                val === undefined && !revealedLetters.value.has(idx)
            );
            
            if (index !== -1) {
                userInput.value[index] = key;
                updateSubmitButton();
            }
        };

        // Check the guessed word
        const checkWord = () => {
            const fullGuess = [...currentWord.word].map((letter, index) => {
                if (revealedLetters.value.has(index)) {
                    return letter.toLowerCase();
                }
                return userInput.value[index]?.toLowerCase() || '';
            }).join('');
            
            const word = currentWord.word.toLowerCase();
            
            if (fullGuess.length !== word.length) {
                shakeLetters();
                const firstEmptyInput = document.querySelector('.letter-input:not([disabled])');
                if (firstEmptyInput) firstEmptyInput.focus();
                return;
            }

            guessCount.value++;

            if (fullGuess === word) {
                showResults();
            } else {
                shakeLetters().then(() => {
                    setTimeout(() => {
                        userInput.value = userInput.value.map((_, i) => 
                            revealedLetters.value.has(i) ? currentWord.word[i].toLowerCase() : undefined
                        );
                    }, 500);
                });
            }
        };

        // Handle reveal letter button click
        const handleRevealLetter = () => {
            if (remainingLetters.value <= 1) return;
            
            // Find the first unrevealed letter
            const firstUnrevealed = [...currentWord.word].findIndex((_, index) => 
                !revealedLetters.value.has(index)
            );
            
            if (firstUnrevealed !== -1) {
                revealedLetters.value.add(firstUnrevealed);
                revealCount.value++;
            }
        };

        // End the round
        const endRound = () => {
            const inputs = document.querySelectorAll('.letter-input');
            inputs.forEach(input => input.disabled = true);
            showMessage(`Round Over! The word was: ${currentWord.word}`, 'error');
            currentWord.word.split('').forEach((_, index) => revealedLetters.value.add(index));
            showResults();
        };

        // Shake letters animation
        const shakeLetters = () => {
            return new Promise(resolve => {
                const inputs = document.querySelectorAll('.letter-input');
                inputs.forEach(input => {
                    input.classList.remove('shake');
                    void input.offsetWidth;
                    input.classList.add('shake');
                });
                setTimeout(() => {
                    inputs.forEach(input => {
                        input.classList.remove('shake');
                    });
                    resolve();
                }, 500);
            });
        };

        // Show message
        const showMessage = (text, type) => {
            message.value = text;
            messageType.value = `message ${type} visible`;
            if (!text.includes('Round Over')) {
                setTimeout(() => {
                    messageType.value = '';
                }, 3000);
            }
        };

        // Handle letter input event
        const handleLetterInputEvent = (e) => {
            const input = e.target;
            const index = parseInt(input.dataset.index);
            
            if (revealedLetters.value.has(index)) {
                e.preventDefault();
                return;
            }

            const value = input.value.toLowerCase();

            if (/^[a-z]$/.test(value)) {
                userInput.value[index] = value;
                
                let nextIndex = index + 1;
                while (nextIndex < currentWord.word.length && revealedLetters.value.has(nextIndex)) {
                    nextIndex++;
                }
                
                const nextInput = input.parentElement.querySelector(`[data-index="${nextIndex}"]`);
                if (nextInput && !nextInput.disabled) {
                    nextInput.focus();
                }
                updateSubmitButton();
            } else {
                input.value = '';
                userInput.value[index] = undefined;
                updateSubmitButton();
            }
        };

        // Handle letter keydown event
        const handleLetterKeydownEvent = (e) => {
            const input = e.target;
            const index = parseInt(input.dataset.index);

            if (revealedLetters.value.has(index)) {
                e.preventDefault();
                return;
            }

            if (e.key === 'Backspace' && !input.value) {
                const prevInput = input.parentElement.querySelector(`[data-index="${index - 1}"]`);
                if (prevInput && !prevInput.disabled) {
                    prevInput.focus();
                    prevInput.value = '';
                    userInput.value[index - 1] = undefined;
                }
                e.preventDefault();
                updateSubmitButton();
            } else if (e.key === 'Enter' && allFilled.value) {
                checkWord();
                e.preventDefault();
            }
        };

        // Update submit button state
        const updateSubmitButton = () => {
            const allFilledValue = [...currentWord.word].every((_, index) => {
                return revealedLetters.value.has(index) || (userInput.value[index] !== undefined);
            });
            allFilled.value = allFilledValue;
        };

        // Update copyResults method to only share emojis and stats
        const copyResults = () => {
            const textToShare = `Word Quest 🎯\nGuesses: ${guessCount.value}\nReveals: ${revealCount.value}\n${getEmojiResults()}`;
            
            navigator.clipboard.writeText(textToShare)
                .then(() => {
                    const btn = document.getElementById('copy-results');
                    btn.textContent = 'Copied! ✅';
                    setTimeout(() => btn.textContent = 'Copy Results 📋', 2000);
                });
        };

        // Get emoji results
        const getEmojiResults = () => {
            const emojis = [...currentWord.word].map((letter, index) => {
                if (revealedLetters.value.has(index)) {
                    return '🟨'; // Yellow square for revealed letters
                } else {
                    return '🟩'; // Green square for correctly guessed letters
                }
            });
            return emojis.join('');
        };

        // Show results in modal
        const showResults = () => {
            resultsText.value = getEmojiResults();
            showModal.value = true;
        };

        // Initialize the game
        loadNewWord();

        return {
            revealCount,
            guessCount,
            message,
            messageType,
            currentWord,
            partialWord,
            resultsText,
            showModal,
            showAboutModal,
            allFilled,
            remainingLetters,
            loadNewWord,
            handleVirtualKeyPress,
            checkWord,
            handleRevealLetter,
            copyResults
        };
    }
});

app.mount('#app');
