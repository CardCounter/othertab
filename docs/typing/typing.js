import { words_none } from './words/1k.js';

// like a queue but no popping. keep moving and writing at head. once reach end, go back to begining (oldest) and just
// write over it. first in first out.
class CircularQueue {
    constructor(size, key) {
        this.size = size;
        this.key = key; // to find in localstorage, use TYPING-rolling-avg-100

        const data = this.load();
        this.buffer = data?.buffer || new Array(size).fill(null); // buffer is queue full of data, check if buffer exists if not
                                                                  // make new
        this.head = data?.head || 0;
        this.length = data?.length || 0;
    }

    enqueue(value) {
        this.buffer[this.head] = value; // possible write over old data, or fresh spot
        this.head = (this.head + 1) % this.size; // using this.size
        if (this.length < this.size) {
            this.length++; // used for getall, just so if queue not filled not reading null
        }
        this.save();
    }

    getAll() {
        const out = []; // returns array of data elements, for each entry call data.wpm, data.acc
        const start = (this.head - this.length + this.size) % this.size; // this.head is the next available space, not the 
                                                                         // oldest data point, this fixes that
        for (let i = 0; i < this.length; i++) {
            const index = (start + i) % this.size; // start at next available empty or oldest, loop around.
            const item = this.buffer[index];
            if (item) out.push(item);
        }
        return out;
    }

    save() { // used in enqueue
        const data = {
            buffer: this.buffer,
            head: this.head,
            length: this.length
        };
        localStorage.setItem(this.key, JSON.stringify(data));
    }

    load() { // used in constructor
        const raw = localStorage.getItem(this.key);
        return raw ? JSON.parse(raw) : null;
    }
}

class Typing {
    constructor(){
        this.typingResults = new CircularQueue(100, 'TYPING-rolling-avg-100');

        // constants
        this.words = words_none; 
        this.wordsLength = this.words.length - 1;

        // vars
        this.masterString = '';
        this.masterArray = [];
        this.masterArrayLength = 0;
        this.displayArray = [];
        this.characterArray = [];
        this.userTyped = [];
        this.currentIndex = -1;

        this.timer = 0;
        this.timerInterval = null;
        this.numMistakes = 0;
        this.numCharMasterString = 0;
        this.numWordsMasterString = 0;
        this.wpm = 0;
        this.acc = 0;

        this.firstKey = false;
        this.boardAllCorrect = false;
        this.typingDone = false;
        this.canType = true;


        if (localStorage.getItem('TYPING-currentWordMode')){
            this.currentWordMode = localStorage.getItem('TYPING-currentWordMode');
        }
        else{
            this.currentWordMode = 'mode-50';
        }
        
        document.getElementById(this.currentWordMode).classList.add('active');
        this.numWords = document.getElementById(this.currentWordMode).dataset.time;

        // console.log(`${this.numWords}`)

        this.initializeBoard(this.numWords);

        const wordButtons = document.querySelectorAll('.mode-button');
        wordButtons.forEach(button => {
            button.addEventListener('click', () => {
                // reset all to active state
                wordButtons.forEach(btn => btn.classList.remove('active'));
                
                // add active state for chosen button
                button.classList.add('active');
                
                // set difficulty and reset game
                this.currentWordMode = button.id;
                localStorage.setItem('TYPING-currentWordMode', button.id);
                this.numWords = document.getElementById(this.currentWordMode).dataset.time;
                this.resetBoard(this.numWords);
            });
        });

        document.addEventListener('keydown', (e) => {
            this.stopBlinking();
            if (e.code === 'Space' && document.activeElement.tagName === 'BUTTON') {
                e.preventDefault();
            }
            if (this.canType){
                if (this.userTyped.length < this.masterArrayLength) {
                    // console.log('in short case');
                    if (/^[a-zA-Z0-9 !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/.test(e.key)) {
                        if (this.firstKey === false){
                            this.firstKey = true; /// start timer here
                            this.setTypingTitle(true);
                            this.startTimer();
                            // console.log(`start timer: ${this.timer}`)
                        }
    
                        this.userTyped.push(e.key);
                        this.currentIndex++;
                        this.checkCharacterStyle(this.masterArray, this.userTyped, this.currentIndex, this.characterArray);
                        this.moveCaretTo(this.currentIndex);
                    } 
                    else if (e.key === 'Backspace' && (e.altKey || e.metaKey || e.ctrlKey)) {
                        // console.log(`calling backspace word`);
                        this.backspaceWord();
                    }
                    else if (e.key === 'Backspace') {
                        // console.log(`callling backspace`);
                        this.backspace();
                    }
                    if (this.boardAllCorrect === false){
                        this.boardAllCorrect = this.checkAllCorrect();

                        if (this.boardAllCorrect){
                            this.typingDone = true;
                            this.canType = false;
                            // console.log(`game finish`)

                            this.setTypingTitle(false);

                            // add tombstone to end
                            const typedText = document.getElementById('typed-text');
                            typedText.innerHTML = typedText.innerHTML + `<span class="tombstone">∎</span>`;

                            this.stopTimer();
                            // console.log(`stopped timer: ${this.timer}`)

                            // get wpm, acc
                            this.wpm = this.getWPM();
                            this.acc = this.getAcc();
                            this.showWPMPopup();
                            this.saveStats(this.wpm, this.acc, this.currentWordMode);
                        }
                    }
                }
                else{
                    // console.log('in long case');
                    if (e.key === 'Backspace' && (e.altKey || e.metaKey || e.ctrlKey)) {
                        // console.log(`calling backspace word`)
                        this.backspaceWord();
                    }
                    else if (e.key === 'Backspace') {
                        // console.log(`callling backspace`)
                        this.backspace();
                    }
                }
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                this.resetBoard(this.numWords);
            }
        });   
    }

    initializeBoard(numWords){
        const typedText = document.getElementById('typed-text');

        this.masterString = this.chooseRandomWords(numWords);
        this.numCharMasterString = this.masterString.length;
        // const wordCountArray = this.masterString.split(' ');
        this.numWordsMasterString = this.masterString.split(' ').length
        // this.masterString = this.chooseRandomWords(numWords);

        this.masterArray = this.masterString.split('');
        this.masterArrayLength = this.masterArray.length;
        this.displayArray = this.masterArray.map(char => `<span class="character">${char}</span>`);

        typedText.innerHTML = this.displayArray.join('');
        this.characterArray = typedText.querySelectorAll('.character');
        this.moveCaretTo(-1);
    }

    chooseRandomWords(count){
        const newWords = [];
        for (let i = 0; i < count; i++){
            newWords.push(this.words[Math.floor(Math.random() * this.wordsLength)]);
        }
        let wordString = newWords.join(' ');

        return wordString.trim();
    }

    resetBoard(numWords){
        this.stopTimer();

        this.masterString = '';
        this.masterArray = [];
        this.masterArrayLength = 0;
        this.displayArray = [];
        this.characterArray = [];
        this.userTyped = [];
        this.currentIndex = -1;

        this.timer = 0;
        this.timerInterval = null;
        this.numMistakes = 0;
        this.numCharMasterString = 0;
        this.numWordsMasterString = 0;
        this.wpm = 0;
        this.acc = 0;

        this.firstKey = false;
        this.boardAllCorrect = false;
        this.typingDone = false;
        this.canType = true;

        this.initializeBoard(numWords);
        this.setTypingTitle(false);

        document.getElementById('copy-button').textContent = 'share';

        const popup = document.getElementById('wpm-paste');
        if (popup) popup.classList.add('hidden'); ///// keep this in mind if things go wrong
    }

    backspace(){
        this.userTyped.pop();
    
        if (this.currentIndex > -1){
            this.removeCharacteraStyle(this.currentIndex, this.characterArray);
            this.currentIndex--;
            this.moveCaretTo(this.currentIndex);
        }
        else this.currentIndex = -1; // safety
        this.moveCaretTo(this.currentIndex);
    }

    backspaceWord() {
        if (this.userTyped[this.userTyped.length - 1] === ' '){
            this.backspace();
        }
        while (this.userTyped.length > 0) {
            const lastChar = this.userTyped[this.userTyped.length - 1];
            if (lastChar === ' ') break;
            this.backspace();
        }
    }

    stopBlinking() {
        let blinkTimeout;
        const caret = document.querySelector('.caret');
        caret.style.animation = 'none';
        clearTimeout(blinkTimeout);
        
        blinkTimeout = setTimeout(() => {
            caret.style.animation = 'blink 1s step-end infinite';
        }, 1000);
    }

    checkCharacterStyle(masterArray, userTyped, currentIndex, characterArray){
        if (currentIndex === -1) return; // no letters
        else if (userTyped.length - 1 < currentIndex) { // too small => messed up somewhere?, keep for safety
            characterArray[currentIndex].classList.remove('correct');
            characterArray[currentIndex].classList.remove('wrong');
        }
        else if (userTyped[currentIndex] === masterArray[currentIndex]) { // right
            characterArray[currentIndex].classList.remove('wrong');
            characterArray[currentIndex].classList.add('correct');
        }
        else { // wrong
            characterArray[currentIndex].classList.remove('correct');
            characterArray[currentIndex].classList.add('wrong');
            this.numMistakes++;
        }
    }

    removeCharacteraStyle(currentIndex, characterArray){
        characterArray[currentIndex].classList.remove('correct');
        characterArray[currentIndex].classList.remove('wrong');
    }

    checkAllCorrect(){
        for (let char of this.characterArray){
            if (!char.classList.contains('correct')) return false;
        }
        // console.log(`checkAllCorrect true`);
        return true;
    }

    moveCaretTo(index){
        if (index < this.masterArrayLength - 1){
            const typedText = document.getElementById('typed-text');

            const target = typedText.querySelectorAll('.character')[index + 1];
            const caret = document.getElementById('caret');
            caret.classList.remove('hidden');
    
            const textContainerLocation = typedText.getBoundingClientRect();
            const targetLocation = target.getBoundingClientRect();
    
            caret.style.left = (targetLocation.left - textContainerLocation.left) + 'px';
            caret.style.top = (targetLocation.top - textContainerLocation.top) + 'px';
        }
        else{ // moves it off the screen. i guess its ok, if last letter is wrong can backspace and caret will still be there.
            const caret = document.getElementById('caret');
            caret.classList.add('hidden'); 
        }
    }

    startTimer() {
        this.stopTimer();
        this.timer = 0;
        
        this.timerInterval = setInterval(() => {
            if (this.timer < 999){
                this.timer++;
            }
            else {
                clearInterval(this.timerInterval);
                this.timer = -1; /////// if -1 add NA to wpm
            }   
            // console.log(`${this.timer}`);
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    setTypingTitle(isTyping) {
        document.title = isTyping ? 'typing...' : 'typing';
    }

    getWPM() {
        // console.log(`${this.timer}`)
        if (this.timer === -1) return 0; // if too slow, return 0. dont want to return -1 since will look like it broke
        let avgNumWords = this.numCharMasterString / 5;
        let normTime = this.timer / 60;
        return Math.round(avgNumWords / normTime);
    }

    getAcc() {
        if (this.numMistakes >= this.numCharMasterString) return 0; // if too many mistakes
        return Math.round((1 - (this.numMistakes / this.numCharMasterString)) * 100);
    }

    showWPMPopup(){
        const popup = document.getElementById('wpm-paste');
        const text = document.getElementById('wpm-text');

        text.innerHTML = `wpm ${this.wpm} acc ${this.acc}%`;

        const plainText = `TYPING ${this.numWords}
${this.wpm} wpm
${this.acc}% acc`;

        const shareButton = document.getElementById('copy-button');

        shareButton.addEventListener('click', () => {
            navigator.clipboard.writeText(plainText);
            shareButton.textContent = 'copied';
        });
            
        // display popup by adding hidden class, removing active
        popup.classList.remove('hidden');
    }

    saveStats(wpm, acc, currentWordMode){
        // add to queue
        this.typingResults.enqueue({
            wpm: wpm,
            acc: acc,
        });

        this.updateAvg();

        // checks best for mode
        const bestCurrentModeKey = `TYPING-best-${currentWordMode}`;
        const bestCurrentModeRaw = localStorage.getItem(bestCurrentModeKey);
        const bestCurrentMode = bestCurrentModeRaw ? JSON.parse(bestCurrentModeRaw) : null;

        if (!bestCurrentMode || wpm > bestCurrentMode.wpm){
            const bestData = {
                wpm: wpm,
                acc: acc
            }

            localStorage.setItem(bestCurrentModeKey, JSON.stringify(bestData));
        }
    }

    updateAvg(){
        const data = this.typingResults.getAll();
        const totalWPM = data.reduce((sum, data) => sum + data.wpm, 0);
        const totalACC = data.reduce((sum, data) => sum + data.acc, 0);
        const avgWPM = data.length ? Math.round(totalWPM / data.length) : 0;
        const avgACC = data.length ? Math.round(totalACC / data.length) : 0;

        const avgData = {
            wpm: avgWPM,
            acc: avgACC
        };

        localStorage.setItem('TYPING-avg', JSON.stringify(avgData));
    }

}

window.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.remove('js-loading');
    const typing = new Typing();
});
