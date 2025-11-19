import { TypingSeed } from './seed.js';
import { words_none } from './words/1k.js';



class CircularQueue {
    constructor(size, key) {
        this.size = size;
        this.key = key;

        const data = this.load();
        this.buffer = data?.buffer || new Array(size).fill(null);

        this.head = data?.head || 0;
        this.length = data?.length || 0;
    }

    enqueue(value) {
        this.buffer[this.head] = value;
        this.head = (this.head + 1) % this.size;
        if (this.length < this.size) {
            this.length++;
        }
        this.save();
    }

    getAll() {
        const out = [];
        const start = (this.head - this.length + this.size) % this.size;

        for (let i = 0; i < this.length; i++) {
            const index = (start + i) % this.size;
            const item = this.buffer[index];
            if (item) out.push(item);
        }
        return out;
    }

    save() {
        const data = {
            buffer: this.buffer,
            head: this.head,
            length: this.length
        };
        localStorage.setItem(this.key, JSON.stringify(data));
    }

    load() {
        const raw = localStorage.getItem(this.key);
        return raw ? JSON.parse(raw) : null;
    }
}

class Typing {
    constructor(){
        this.typingResults = new CircularQueue(100, 'TYPING-rolling-avg-100');


        this.words = words_none; 
        this.wordListKey = 'none';
        this.wordListSize = this.words.length;


        this.masterString = '';
        this.masterArray = [];
        this.masterArrayLength = 0;
        this.displayArray = [];
        this.characterArray = [];
        this.userTyped = [];
        this.currentIndex = -1;
        this.currentSeed = '';
        this.currentWordIndices = [];

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
        this.shareResetTimer = null;

        this.typingWrapper = document.querySelector('.typing-wrapper');
        this.topVisibleLineIndex = 0;
        this.currentLineIndex = 0;
        this.completionIndicator = null;
        this.resizeRaf = null;

        this.stageEl = document.querySelector('.typing-stage');
        if (this.stageEl) {
            this.stageEl.addEventListener('contextmenu', (event) => {
                event.preventDefault();
            });
            this.stageEl.addEventListener('selectstart', (event) => {
                event.preventDefault();
            });
        }


        if (localStorage.getItem('TYPING-currentWordMode')){
            this.currentWordMode = localStorage.getItem('TYPING-currentWordMode');
        }
        else{
            this.currentWordMode = 'mode-50';
        }
        
        this.wordButtons = document.querySelectorAll('.mode-button');
        const initialModeButton = document.getElementById(this.currentWordMode);
        if (initialModeButton){
            initialModeButton.classList.add('active');
            this.numWords = parseInt(initialModeButton.dataset.time, 10);
        }
        else{
            this.currentWordMode = 'mode-50';
            this.numWords = 50;
            const fallbackButton = document.getElementById(this.currentWordMode);
            if (fallbackButton){
                fallbackButton.classList.add('active');
            }
        }
        if (!Number.isFinite(this.numWords) || this.numWords <= 0){
            this.numWords = 50;
        }



        const seeded = this.initializeFromUrlSeed();
        if (!seeded){
            this.resetBoard(this.numWords);
        }
        window.addEventListener('resize', () => this.handleResize());

        this.wordButtons.forEach(button => {
            button.addEventListener('click', () => {

                this.wordButtons.forEach(btn => btn.classList.remove('active'));
                

                button.classList.add('active');
                

                this.currentWordMode = button.id;
                localStorage.setItem('TYPING-currentWordMode', button.id);
                this.numWords = parseInt(button.dataset.time, 10);
                this.resetBoard(this.numWords);
            });
        });

        document.addEventListener('keydown', (e) => {
            this.stopBlinking();
            const isSpace = e.code === 'Space' || e.key === ' ';
            if (isSpace && document.activeElement.tagName === 'BUTTON') {
                e.preventDefault();
            }
            if (isSpace && this.canType) {
                e.preventDefault();
            }
            if (this.canType){
                if (this.userTyped.length < this.masterArrayLength) {

                    if (/^[a-zA-Z0-9 !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/.test(e.key)) {
                        if (this.firstKey === false){
                            this.firstKey = true;
                            this.setTypingTitle(true);
                            this.startTimer();

                        }
    
                        this.userTyped.push(e.key);
                        this.currentIndex++;
                        this.checkCharacterStyle(this.masterArray, this.userTyped, this.currentIndex, this.characterArray);
                        this.moveCaretTo(this.currentIndex);
                    } 
                    else if (e.key === 'Backspace' && (e.altKey || e.metaKey || e.ctrlKey)) {

                        this.backspaceWord();
                    }
                    else if (e.key === 'Backspace') {

                        this.backspace();
                    }
                    if (this.boardAllCorrect === false){
                        this.boardAllCorrect = this.checkAllCorrect();

                        if (this.boardAllCorrect){
                            this.typingDone = true;
                            this.canType = false;


                            this.setTypingTitle(false);


                            this.updateCompletionMarker();

                            this.stopTimer();



                            this.wpm = this.getWPM();
                            this.acc = this.getAcc();
                            this.showWPMPopup();
                            this.saveStats(this.wpm, this.acc, this.currentWordMode);
                        }
                    }
                }
                else{

                    if (e.key === 'Backspace' && (e.altKey || e.metaKey || e.ctrlKey)) {

                        this.backspaceWord();
                    }
                    else if (e.key === 'Backspace') {

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

    initializeBoard(numWords, options = {}){
        const typedText = document.getElementById('typed-text');
        if (!typedText) return;

        const { wordIndices, seed, skipUrlUpdate } = options;
        let indices = Array.isArray(wordIndices) ? wordIndices.slice() : null;
        const providedCount = Number(numWords);
        let desiredCount = indices?.length || (providedCount > 0 ? providedCount : this.numWords || 0);
        if (desiredCount <= 0){
            desiredCount = 1;
        }
        if (!indices || !indices.length || indices.length !== desiredCount){
            indices = this.chooseRandomWordIndices(desiredCount);
        }

        const derivedSeed = indices.length ? (seed || this.generateSeedFromIndices(indices)) : '';

        this.currentSeed = derivedSeed;
        this.currentWordIndices = indices.slice();
        this.numWords = indices.length;

        if (!skipUrlUpdate){
            this.updateSeedInUrl(this.currentSeed);
        }

        this.masterString = this.buildWordString(indices);
        this.numCharMasterString = this.masterString.length;
        this.numWordsMasterString = indices.length;


        this.masterArray = this.masterString.split('');
        this.masterArrayLength = this.masterArray.length;
        this.displayArray = this.masterArray.map(char => `<span class="character">${char}</span>`);

        typedText.innerHTML = this.displayArray.join('');
        this.characterArray = typedText.querySelectorAll('.character');
        this.resetScrollPosition();
        this.ensureCompletionIndicator(typedText);
        this.updateCompletionMarker();
        this.moveCaretTo(-1);
    }

    chooseRandomWordIndices(count){
        const total = Number(count) || 0;
        const indices = [];
        for (let i = 0; i < total; i++){
            indices.push(Math.floor(Math.random() * this.wordListSize));
        }
        return indices;
    }

    buildWordString(indices){
        const words = indices.map(idx => {
            if (idx >= 0 && idx < this.wordListSize){
                return this.words[idx];
            }
            return this.words[0];
        });
        return words.join(' ').trim();
    }

    generateSeedFromIndices(indices){
        if (!Array.isArray(indices) || !indices.length){
            return '';
        }
        return TypingSeed.createSeed({
            wordIndices: indices,
            wordListKey: this.wordListKey,
            vocabSize: this.wordListSize
        });
    }

    updateSeedInUrl(seed){
        if (typeof window === 'undefined' || !window.history || typeof window.history.replaceState !== 'function'){
            return;
        }
        const url = new URL(window.location.href);
        url.search = seed ? `?${seed}` : '';
        const newRelative = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState({}, '', newRelative);
    }

    buildSeedUrl(){
        if (typeof window === 'undefined' || !this.currentSeed){
            return '';
        }
        return `${window.location.origin}${window.location.pathname}?${this.currentSeed}`;
    }

    initializeFromUrlSeed(){
        if (typeof window === 'undefined'){
            return false;
        }
        const search = window.location.search;
        const seedParam = search && search.startsWith('?') ? search.slice(1) : '';
        if (!seedParam){
            return false;
        }
        try {
            const parsed = TypingSeed.parseSeed(seedParam, { vocabSize: this.wordListSize });
            if (!parsed.wordIndices.length){
                return false;
            }
            this.numWords = parsed.wordCount;
            this.updateActiveModeButton(parsed.wordCount);
            this.resetBoard(parsed.wordCount, { wordIndices: parsed.wordIndices, seed: parsed.seed, skipUrlUpdate: true });
            this.updateSeedInUrl(parsed.seed);
            return true;
        }
        catch (error){
            console.error('invalid typing seed', error);
            this.updateSeedInUrl('');
            return false;
        }
    }

    updateActiveModeButton(wordCount){
        if (!this.wordButtons || !this.wordButtons.length){
            return;
        }
        let matched = false;
        this.wordButtons.forEach(button => {
            const isMatch = parseInt(button.dataset.time, 10) === wordCount;
            button.classList.toggle('active', isMatch);
            if (isMatch){
                matched = true;
                this.currentWordMode = button.id;
                localStorage.setItem('TYPING-currentWordMode', button.id);
            }
        });
        if (!matched){
            this.currentWordMode = null;
        }
    }

    resetBoard(numWords, options = {}){
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

        this.initializeBoard(numWords, options);
        this.setTypingTitle(false);

        this.clearShareResetTimer();
        const copyButton = document.getElementById('copy-button');
        if (copyButton) {
            copyButton.textContent = 'share';
        }

        const popup = document.getElementById('wpm-paste');
        if (popup) popup.classList.add('hidden');
    }

    resetScrollPosition(){
        const typedText = document.getElementById('typed-text');
        if (typedText){
            typedText.style.transform = 'translateY(0px)';
        }
        this.topVisibleLineIndex = 0;
        this.currentLineIndex = 0;
    }

    ensureCompletionIndicator(typedText){
        if (!typedText) return;
        if (!this.completionIndicator){
            this.completionIndicator = document.createElement('span');
            this.completionIndicator.classList.add('completion-indicator');
        }
        typedText.appendChild(this.completionIndicator);
        this.completionIndicator.textContent = '';
        this.completionIndicator.classList.remove('wrong', 'correct');
    }

    updateCompletionMarker(){
        if (!this.completionIndicator) return;
        this.completionIndicator.classList.remove('wrong', 'correct');
        if (this.userTyped.length < this.masterArrayLength){
            this.completionIndicator.textContent = '';
            return;
        }

        if (this.boardAllCorrect){
            this.completionIndicator.textContent = '∎';
            this.completionIndicator.classList.add('correct');
            return;
        }

        this.completionIndicator.textContent = '∅';
        this.completionIndicator.classList.add('wrong');
    }

    handleResize(){
        if (!this.characterArray.length) return;
        if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
        this.resizeRaf = requestAnimationFrame(() => {
            this.moveCaretTo(this.currentIndex);
            this.resizeRaf = null;
        });
    }

    getLineHeightPx(){
        const typedText = document.getElementById('typed-text');
        if (!typedText) return 0;

        const computed = window.getComputedStyle(typedText);
        const lineHeight = parseFloat(computed.lineHeight);
        if (!Number.isNaN(lineHeight) && lineHeight > 0) return lineHeight;

        const fontSize = parseFloat(computed.fontSize);
        if (!Number.isNaN(fontSize) && fontSize > 0) {
            return fontSize * 1.2;
        }
        return 0;
    }

    updateScrollForTarget(targetSpan){
        const typedText = document.getElementById('typed-text');
        if (!typedText || !targetSpan || !this.characterArray.length) return;

        const firstSpan = this.characterArray[0];
        if (!firstSpan) return;

        const lineHeight = this.getLineHeightPx();
        if (!lineHeight) return;

        const firstRect = firstSpan.getBoundingClientRect();
        const targetRect = targetSpan.getBoundingClientRect();
        const deltaTop = (targetRect.top - firstRect.top);

        const currentLine = Math.max(Math.round(deltaTop / lineHeight), 0);
        if (currentLine !== this.currentLineIndex) {
            this.currentLineIndex = currentLine;
            this.topVisibleLineIndex = this.currentLineIndex > 0 ? this.currentLineIndex - 1 : 0;
            const translateY = -(this.topVisibleLineIndex * lineHeight);
            typedText.style.transform = `translateY(${translateY}px)`;
        }
    }

    backspace(){
        this.userTyped.pop();
    
        if (this.currentIndex > -1){
            this.removeCharacteraStyle(this.currentIndex, this.characterArray);
            this.currentIndex--;
            this.moveCaretTo(this.currentIndex);
        }
        else this.currentIndex = -1;
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
        if (currentIndex === -1) return;
        else if (userTyped.length - 1 < currentIndex) {
            characterArray[currentIndex].classList.remove('correct');
            characterArray[currentIndex].classList.remove('wrong');
        }
        else if (userTyped[currentIndex] === masterArray[currentIndex]) {
            characterArray[currentIndex].classList.remove('wrong');
            characterArray[currentIndex].classList.add('correct');
        }
        else {
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

        return true;
    }

    moveCaretTo(index){
        const typedText = document.getElementById('typed-text');
        const caret = document.getElementById('caret');
        if (!typedText || !caret || !this.characterArray.length) return;

        const wrapper = this.typingWrapper || typedText.parentElement;
        if (!wrapper) return;

        const lastCharIndex = this.characterArray.length - 1;
        const nextIndex = Math.max(0, Math.min(index + 1, lastCharIndex));
        const target = this.characterArray[nextIndex];
        if (!target) return;

        this.updateScrollForTarget(target);

        const wrapperRect = wrapper.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        caret.style.left = (targetRect.left - wrapperRect.left) + 'px';
        caret.style.top = (targetRect.top - wrapperRect.top) + 'px';

        if (index < this.masterArrayLength - 1){
            caret.classList.remove('hidden');
        }
        else{
            caret.classList.add('hidden'); 
        }
        this.updateCompletionMarker();
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
                this.timer = -1;
            }   

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

        if (this.timer === -1) return 0;
        let avgNumWords = this.numCharMasterString / 5;
        let normTime = this.timer / 60;
        return Math.round(avgNumWords / normTime);
    }

    getAcc() {
        if (this.numMistakes >= this.numCharMasterString) return 0;
        return Math.round((1 - (this.numMistakes / this.numCharMasterString)) * 100);
    }

    clearShareResetTimer() {
        if (this.shareResetTimer) {
            clearTimeout(this.shareResetTimer);
            this.shareResetTimer = null;
        }
    }

    showWPMPopup(){
        const popup = document.getElementById('wpm-paste');
        const text = document.getElementById('wpm-text');


        const hasCompletedFirstTest = localStorage.getItem('TYPING-first-test-completed');
        const isFirstTime = !hasCompletedFirstTest;

        const intro = isFirstTime ? 'press enter to reset. ' : '';
        text.innerHTML = `${intro}wpm ${this.wpm}, acc ${this.acc}%.`;

        const lines = [
            `TYPING_${this.numWords}`,
            `${this.wpm} wpm`,
            `${this.acc}% acc`
        ];
        const seedUrl = this.currentSeed ? `https://othertab.com/typing/?${this.currentSeed}` : 'https://othertab.com/typing/';
        lines.push(seedUrl);
        const plainText = lines.join('\n');

        const shareButton = document.getElementById('copy-button');

        if (shareButton) {
            shareButton.textContent = 'share';
            shareButton.onclick = () => {
                navigator.clipboard.writeText(plainText);
                shareButton.textContent = 'copied';
                this.clearShareResetTimer();
                this.shareResetTimer = setTimeout(() => {
                    shareButton.textContent = 'share';
                    this.shareResetTimer = null;
                }, 1000);
            };
        }
            

        popup.classList.remove('hidden');
    }

    saveStats(wpm, acc, currentWordMode){

        this.typingResults.enqueue({
            wpm: wpm,
            acc: acc,
        });

        this.updateAvg();


        if (!localStorage.getItem('TYPING-first-test-completed')) {
            localStorage.setItem('TYPING-first-test-completed', 'true');
        }


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
