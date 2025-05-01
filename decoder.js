const timeNumbers = {
    0:'⓪',
    1:'①',
    2:'②',
    3:'③',
    4:'④',
    5:'⑤',
    6:'⑥',
    7:'⑦',
    8:'⑧',
    9:'⑨',
    10:'⑩',
    11:'⑪',
    12:'⑫',
    13:'⑬',
    14:'⑭',
    15:'⑮',
    16:'⑯',
    17:'⑰',
    18:'⑱',
    19:'⑲',
    20:'⑳',
};

const timeDigits = {
    0:'⓪',
    1:'①',
    2:'②',
    3:'③',
    4:'④',
    5:'⑤',
    6:'⑥',
    7:'⑦',
    8:'⑧',
    9:'⑨',
};

const securityDifficultyDict = {
    easy: 555,
    medium: 777,
    hard: 999,
};

const securityCodeMines = {
    0: 'MINES',
    1: 'MIN\u200BES',
    2: 'MI\u200BNES',
    3: 'MI\u200BN\u200BES',
    4: 'M\u200BINES',
    5: 'M\u200BIN\u200BES',
    6: 'M\u200BI\u200BNES',
    7: 'M\u200BI\u200BN\u200BES',
    8: '\u200BMINES',
    9: '\u200BMIN\u200BES',
}

const securityCodeEasy = {
    0: 'EASY',
    1: 'EAS\u200BY',
    2: 'EA\u200BSY',
    3: 'EA\u200BS\u200BY',
    4: 'E\u200BASY',
    5: 'E\u200BAS\u200BY',
    6: 'E\u200BA\u200BSY',
    7: 'E\u200BA\u200BS\u200BY',
    8: '\u200BEASY',
    9: '\u200BEAS\u200BY',
}

const securityCodeMedium = {
    0: 'MEDIUM',
    1: 'MED\u200BIUM',
    2: 'ME\u200BDIUM',
    3: 'ME\u200BD\u200BIUM',
    4: 'M\u200BEDIUM',
    5: 'M\u200BED\u200BIUM',
    6: 'M\u200BE\u200BDIUM',
    7: 'M\u200BE\u200BD\u200BIUM',
    8: '\u200BMEDIUM',
    9: '\u200BMED\u200BIUM',
}

const securityCodeHard = {
    0: 'HARD',
    1: 'HAR\u200BD',
    2: 'HA\u200BRD',
    3: 'HA\u200BR\u200BD',
    4: 'H\u200BARD',
    5: 'H\u200BAR\u200BD',
    6: 'H\u200BA\u200BRD',
    7: 'H\u200BA\u200BR\u200BD',
    8: '\u200BHARD',
    9: '\u200BHAR\u200BD',
}

const securityCodeTimeFunctionNormal = (timerValue) => ({
    0: timerValue,
    1: timerValue + '\u200B',
    2: '\u200B' + timerValue,
    3: '\u200B' + timerValue + '\u200B'
});

const securityCodeTimeFunctionGoodTime = (timerValue) => ({
    0: timerValue + '!',
    1: timerValue + '\u200B' + '!',
    2: '\u200B' + timerValue + '!',
    3: '\u200B' + timerValue + '\u200B' + '!'
});

const pseudoSalt = [
    44543, 37046, 59565, 33240, 61607,
    87252, 69176, 67945, 77292, 12558,
    91918, 77009, 19217, 80068, 96935,
    55483, 91826, 62935, 40004, 96288,
    33797, 84552, 93229, 45102, 54682,
    64385, 62469, 41605, 83822, 10193
];

function encode(difficulty, timer, timerValue, goodTime, saltValue){
    let rawNum = timer * securityDifficultyDict[difficulty] + saltValue;
    console.log("first num: " + rawNum);

    let fullNum = rawNum;
    let sum = 0;
    while(fullNum > 0){
        let digit = fullNum % 10;
        sum += digit;
        fullNum = Math.floor(fullNum / 10);
    }

    rawNum += sum;
    console.log("num raw after sum: " + rawNum);
    
    if(goodTime == '!') rawNum += 111;

    let finalNum = rawNum % 1000;
    console.log("finalNum: " + finalNum);
    let firstTwo = Math.floor(finalNum / 10);

    let hundredsDigit = Math.floor(firstTwo / 10);
    let tensDigit = firstTwo % 10;
    let onesDigit = (finalNum % 10) % 4; // 0 1 2 3

    console.log("huns: " + hundredsDigit);
    console.log("tens: " + tensDigit);
    console.log("ones: " + onesDigit);

    // get text with hidden
    let titleValue = securityCodeMines[hundredsDigit];
    console.log("titlevalue: " + titleValue);
    let difficultyValue;
    switch (this.difficulty) {
        case 'easy':
            difficultyValue = securityCodeEasy[tensDigit];
            break;
        case 'medium':
            difficultyValue = securityCodeMedium[tensDigit];
            break;
        case 'hard':
        default:
            difficultyValue = securityCodeHard[tensDigit];
            break;
    }
    console.log("diff: " + difficultyValue);
    let securityCodeTime;
    if(goodTime == '!'){
        securityCodeTime = securityCodeTimeFunctionGoodTime(timerValue);
    }
    else{
        securityCodeTime = securityCodeTimeFunctionNormal(timerValue);
    }
    let timeValue = securityCodeTime[onesDigit]; // note this is different than `timerValue`
    console.log("timer: " + timeValue);

    return [titleValue, difficultyValue, timeValue];
}

function timerNumbersToNumber(timerValue) {
    // objects are any collection of key-value pair, dicts are objects, .entries gives k,v, swap, then make into dict again using .fromEntries
    const reverseTimeNumbers = Object.fromEntries(Object.entries(timeNumbers).map(([k, v]) => ([v, k])));
    const reverseTimeDigits = Object.fromEntries(Object.entries(timeDigits).map(([k, v]) => ([v, k])));

    const cleanTimerValue = timerValue.replace(/\u200B|!/g, '');

    // use .hasOwnProperty bc checks for existances. if using reverseTimeDigits[cleanTimerValue] and return value is 0, might give false since 0 is falsly.
    if(reverseTimeNumbers.hasOwnProperty(cleanTimerValue)) return reverseTimeNumbers(cleanTimerValue);

    let workingStringArray = cleanTimerValue.split('').reverse();
    // too tired to explain, see if you remeber tmr or look up
    const sum = workingStringArray.reduce((acc, char, idx) => acc + Math.pow(10, idx + 1) * reverseTimeDigits[char], 0);

    
    return sum;
}






// const lines = text.split(/\r\n|\r|\n/);

// const allowedRe = /^[A-Z\u200B\u24EA-\u24FF\u2460-\u2473!\n\r]+$/;




  // -------------- decoding helpers ----------------
  const allowedRe = /^[A-Z\u200B\u24EA-\u24FF\u2460-\u2473!\n\r]+$/;

  function circledToNumber(str){
    // numbers <=20 have dedicated symbol, else build digit wise
    // Build reverse maps
    const revNumbers = Object.fromEntries(Object.entries(timeNumbers).map(([k,v])=>[v,k]));
    const revDigits  = Object.fromEntries(Object.entries(timeDigits).map(([k,v])=>[v,k]));
    // remove ZWS and !
    const clean=str.replace(/\u200B|!/g,'');
    if(revNumbers.hasOwnProperty(clean)) return parseInt(revNumbers[clean],10);
    // multiple digits
    let total="";
    for(const ch of clean){
      if(!revDigits.hasOwnProperty(ch)) return NaN;
      total+=revDigits[ch];
    }
    return parseInt(total,10);
  }

  function decodeAndValidate(input){
    const original=input.replace(/\r/g,''); // unify newlines
    if(!allowedRe.test(original)) return {ok:false,msg:'Invalid characters'};
    const lines=original.split('\n');
    if(lines.length<3) return {ok:false,msg:'Need 3 lines'};

    const line1=lines[0]; // title w/ ZWS ignored for parsing
    const line2=lines[1];
    const line3=lines.slice(2).join('\n'); // in case extra newlines inside circled digits variations

    // Extract difficulty
    const diffClean=line2.replace(/\u200B/g,'').toLowerCase();
    if(!['easy','medium','hard'].includes(diffClean)) return {ok:false,msg:'Unknown difficulty'};
    const difficulty=diffClean;

    // Extract goodTime and timerValue symbol string (preserve ZWS)
    const goodTime=line3.includes('!')?'!':'';
    const timerValue=line3.replace('!','');
    // Compute timer integer
    const timer=circledToNumber(timerValue);
    if(Number.isNaN(timer)) return {ok:false,msg:'Bad circled number'};

    // Iterate salts
    for(const salt of pseudoSalt){
      const candidate=encode(difficulty,timer,timerValue,goodTime,salt);
      if(candidate===original) return {ok:true,msg:'✔️ Valid code'};
    }
    return {ok:false,msg:'❌ Code not recognised'};
  }

  // -------------- UI wiring ----------------
  const inputEl=document.getElementById('encodedInput');
  const resEl=document.getElementById('result');
  document.getElementById('decodeBtn').addEventListener('click',()=>{
    const {ok,msg}=decodeAndValidate(inputEl.value.trim());
    resEl.style.color=ok?'var(--accent)':'var(--error)';
    resEl.textContent=msg;
  });