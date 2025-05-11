// // const input = document.getElementById('real-input');
// const typedText = document.getElementById('typed-text');
// const placeholder = document.getElementById('placeholder');
// // placeholder.textContent = 

// const words = placeholder.textContent.trim().split(' ');
// const lastWord = words.pop();
// const frontWords = words.map(word => `<span class="wrap-word">${word} </span>`).join('');
// const fullWords = frontWords + `<span class="wrap-word">${lastWord}</span>`;

// placeholder.innerHTML = fullWords;

// const spans = Array.from(placeholder.querySelectorAll('.wrap-word'));

// for (const span of spans) console.log(span, span.getBoundingClientRect());


// const userTyped = [];





// const spans = Array.from(placeholder.querySelectorAll('.wrap-word'));
// let lines = [];
// let currentLineTop = null;
// let currentLine = [];

// for (const span of spans) {
//     const rect = span.getBoundingClientRect();

import { words_none } from './words/1k.js';

class Typing {
    constructor(){
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
        this.wpm = 0;
        this.acc = 0;

        this.firstKey = false;
        this.boardAllCorrect = false;
        this.typingDone = false;
        this.canType = true;

        this.currentWordMode = 'mode-50'
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
                this.numWords = document.getElementById(this.currentWordMode).dataset.time;
                this.resetBoard(this.numWords);
            });
        });

        document.addEventListener('keydown', (e) => { // need to ad option backspace for pop until space, cmd backspace for pop until new line marker
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
                            this.startTimer();
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
                            console.log(`game finish`)

                            // add tombstone to end
                            const typedText = document.getElementById('typed-text');
                            typedText.innerHTML = typedText.innerHTML + `<span class="tombstone">∎</span>`;

                            this.stopTimer();

                            // get wpm, acc
                            this.wpm = this.getWPM();
                            this.acc = this.getAcc();
                            this.showWPMPopup();
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

        this.masterString = this.chooseRandomWords(numWords); /////////////////////////////////////////
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
        }, 300);
    }

    checkCharacterStyle(masterArray, userTyped, currentIndex, characterArray){
        if (currentIndex === -1) return; // no letters
        else if (userTyped.length - 1 < currentIndex) { // too small, messed up somewhere?, safety
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
            // const typedText = document.getElementById('typed-text');

            // const target = typedText.querySelectorAll('.character')[index];
            // const caret = document.getElementById('caret');
    
            // const textContainerLocation = typedText.getBoundingClientRect();
            // const targetLocation = target.getBoundingClientRect();
    
            // caret.style.left = (targetLocation.right - textContainerLocation.right) + 'px';
            // caret.style.top = (targetLocation.top - textContainerLocation.top) + 'px';
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
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    getWPM() {
        console.log(`${this.numWordsMasterString} ${this.timer}`)
        console.log(`${(this.numWordsMasterString * 60) / this.timer}`)
        console.log(`${Math.floor((this.numWordsMasterString * 60) / this.timer)}`)
        console.log(`-----------`)
        return Math.floor((this.numWordsMasterString * 60) / this.timer);
    }

    getAcc() {
        console.log(`${this.numMistakes} ${this.numCharMasterString}`)
        console.log(`${(this.numMistakes / this.numCharMasterString) * 100}`)
        console.log(`${Math.floor((this.numMistakes / this.numCharMasterString) * 100)}`)
        if (this.numMistakes >= this.numCharMasterString) return 0;
        return Math.floor((1 - (this.numMistakes / this.numCharMasterString)) * 100);
    }

    showWPMPopup(){
        const popup = document.getElementById('wpm-paste');
        const text = document.getElementById('wpm-text');
        // let timerValue;

        // if (this.timer <= 20){
        //     timerValue = this.timeNumbers[this.timer];
        // }
        // else {
        //     let currentNum = this.timer;
        //     const finalTime = [];
        //     while(currentNum > 0){
        //         let digit = currentNum % 10;
        //         finalTime.unshift(this.timeDigits[digit]);
        //         currentNum = Math.floor(currentNum / 10);
        //     }
        //     timerValue = finalTime.join('')
        // }
        
        text.innerHTML = `wpm ${this.wpm} acc ${this.acc}%`;
        // <p style="text-align: center;">
        // TYPING<br>
        // ${this.numWords}<br>
        // ${this.wpm} wpm<br>
        // ${this.acc}% acc<br>
        // </p>
        //     `;

        // looks awful, dont want to change it
        const plainText = `TYPING
${this.numWords}
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

}

window.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.remove('js-loading');
    const typing = new Typing();
});
