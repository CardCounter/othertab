this.timeNumbers = {
    0: '⓪',
    1: '①',
    2: '②',
    3: '③',
    4: '④',
    5: '⑤',
    6: '⑥',
    7: '⑦',
    8: '⑧',
    9: '⑨',
    10: '⑩',
    11: '⑪',
    12: '⑫',
    13: '⑬',
    14: '⑭',
    15: '⑮',
    16: '⑯',
    17: '⑰',
    18: '⑱',
    19: '⑲',
    20: '⑳',
    21: '㉑',
    22: '㉒',
    23: '㉓',
    24: '㉔',
    25: '㉕',
    26: '㉖',
    27: '㉗',
    28: '㉘',
    29: '㉙',
    30: '㉚',
    31: '㉛',
    32: '㉜',
    33: '㉝',
    34: '㉞',
    35: '㉟',
    36: '㊱',
    37: '㊲',
    38: '㊳',
    39: '㊴',
    40: '㊵',
    41: '㊶',
    42: '㊷',
    43: '㊸',
    44: '㊹',
    45: '㊺',
    46: '㊻',
    47: '㊼',
    48: '㊽',
    49: '㊾',
    50: '㊿'
};

const reverseTimeNumbers = {
    '⓪': 0,
    '①': 1,
    '②': 2,
    '③': 3,
    '④': 4,
    '⑤': 5,
    '⑥': 6,
    '⑦': 7,
    '⑧': 8,
    '⑨': 9,
    '⑩': 10,
    '⑪': 11,
    '⑫': 12,
    '⑬': 13,
    '⑭': 14,
    '⑮': 15,
    '⑯': 16,
    '⑰': 17,
    '⑱': 18,
    '⑲': 19,
    '⑳': 20,
    '㉑': 21,
    '㉒': 22,
    '㉓': 23,
    '㉔': 24,
    '㉕': 25,
    '㉖': 26,
    '㉗': 27,
    '㉘': 28,
    '㉙': 29,
    '㉚': 30,
    '㉛': 31,
    '㉜': 32,
    '㉝': 33,
    '㉞': 34,
    '㉟': 35,
    '㊱': 36,
    '㊲': 37,
    '㊳': 38,
    '㊴': 39,
    '㊵': 40,
    '㊶': 41,
    '㊷': 42,
    '㊸': 43,
    '㊹': 44,
    '㊺': 45,
    '㊻': 46,
    '㊼': 47,
    '㊽': 48,
    '㊾': 49,
    '㊿': 50
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

const reverseTimeDigits = {
    '⓪': 0,
    '①': 1,
    '②': 2,
    '③': 3,
    '④': 4,
    '⑤': 5,
    '⑥': 6,
    '⑦': 7,
    '⑧': 8,
    '⑨': 9
};

const securityDifficultyDict = {
    easy: 555,
    medium: 777,
    hard: 999,
};

const reverseSecurityDifficultyDict = {
    555: 'easy',
    777: 'medium',
    999: 'hard'
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

const reverseSecurityCodeMines = {
    'MINES': 0,
    'MIN\u200BES': 1,
    'MI\u200BNES': 2,
    'MI\u200BN\u200BES': 3,
    'M\u200BINES': 4,
    'M\u200BIN\u200BES': 5,
    'M\u200BI\u200BNES': 6,
    'M\u200BI\u200BN\u200BES': 7,
    '\u200BMINES': 8,
    '\u200BMIN\u200BES': 9
};


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

const reverseSecurityCodeEasy = {
    'EASY': 0,
    'EAS\u200BY': 1,
    'EA\u200BSY': 2,
    'EA\u200BS\u200BY': 3,
    'E\u200BASY': 4,
    'E\u200BAS\u200BY': 5,
    'E\u200BA\u200BSY': 6,
    'E\u200BA\u200BS\u200BY': 7,
    '\u200BEASY': 8,
    '\u200BEAS\u200BY': 9
};

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

const reverseSecurityCodeMedium = {
    'MEDIUM': 0,
    'MED\u200BIUM': 1,
    'ME\u200BDIUM': 2,
    'ME\u200BD\u200BIUM': 3,
    'M\u200BEDIUM': 4,
    'M\u200BED\u200BIUM': 5,
    'M\u200BE\u200BDIUM': 6,
    'M\u200BE\u200BD\u200BIUM': 7,
    '\u200BMEDIUM': 8,
    '\u200BMED\u200BIUM': 9
};

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

const reverseSecurityCodeHard = {
    'HARD': 0,
    'HAR\u200BD': 1,
    'HA\u200BRD': 2,
    'HA\u200BR\u200BD': 3,
    'H\u200BARD': 4,
    'H\u200BAR\u200BD': 5,
    'H\u200BA\u200BRD': 6,
    'H\u200BA\u200BR\u200BD': 7,
    '\u200BHARD': 8,
    '\u200BHAR\u200BD': 9
};

const securityCodeTimeFunctionNormal = (timerValue) => ({
    0: timerValue,
    1: timerValue + '\u200B',
    2: '\u200B' + timerValue,
    3: '\u200B' + timerValue + '\u200B'
});

const reverseSecurityCodeTimeFunctionNormal = (timerValue) => {
    const key0 = [timerValue].toString();
    const key1 = [timerValue, '\u200B'].join('');
    const key2 = ['\u200B', timerValue].join('');
    const key3 = ['\u200B', timerValue, '\u200B'].join('');
  
    return {
      [key0]: 0,
      [key1]: 1,
      [key2]: 2,
      [key3]: 3
    };
  };

const securityCodeTimeFunctionGoodTime = (timerValue) => ({
    0: timerValue + '!',
    1: timerValue + '\u200B' + '!',
    2: '\u200B' + timerValue + '!',
    3: '\u200B' + timerValue + '\u200B' + '!'
});

// const reverseSecurityCodeTimeFunctionGoodTime = (timerValue) => ({
//     [timerValue + '!']: 0,
//     [timerValue + '\u200B' + '!']: 1,
//     ['\u200B' + timerValue + '!']: 2,
//     ['\u200B' + timerValue + '\u200B' + '!']: 3
// });

// const pseudoSalt = [
//     44543, 37046, 59565, 33240, 61607,
//     87252, 69176, 67945, 77292, 12558,
//     91918, 77009, 19217, 80068, 96935,
//     55483, 91826, 62935, 40004, 96288,
//     33797, 84552, 93229, 45102, 54682,
//     64385, 62469, 41605, 83822, 10193
// ];

const pseudoSalt = [
    10861, 66482, 50712, 44081, 23507, 16375, 68410, 70232, 52054, 79049,
    17234, 99439, 82906, 70320, 85891, 67992, 58433, 99675, 80658, 83976,
    27699, 68507, 81637, 56950, 44649, 54462, 18001, 11329, 53534, 21517,
    13378, 89247, 85984, 61201, 77964, 32183, 87666, 49309, 65172, 90370,
    16297, 50670, 68375, 24100, 81122, 37622, 91750, 35446, 78145, 17889
];

function encode(difficulty, timer, goodTime, saltValue){
    let rawNum = timer * securityDifficultyDict[difficulty] + saltValue;
    // console.log("first num: " + rawNum);

    let fullNum = rawNum;
    let sum = 0;
    while(fullNum > 0){
        let digit = fullNum % 10;
        sum += digit;
        fullNum = Math.floor(fullNum / 10);
    }
    sum = ((rawNum ^ 0xa5a5a5) * 31) % 997;
    rawNum += sum;
    // console.log("num raw after sum: " + rawNum);
    
    if(goodTime == '!') rawNum += 111;

    // need to do it this way to preserve leading 0s
    let finalNum = rawNum % 1000;
    // console.log("finalNum: " + finalNum);
    let firstTwo = Math.floor(finalNum / 10);

    let hundredsDigit = Math.floor(firstTwo / 10);
    let tensDigit = firstTwo % 10;
    let onesDigit = finalNum % 4; // 0 1 2 3

    return [hundredsDigit, tensDigit, onesDigit];
}

function timerNumbersToNumber(timerValue) {
    // // objects are any collection of key-value pair, dicts are objects, .entries gives k,v, swap, then make into dict again using .fromEntries
    // const reverseTimeNumbers = Object.fromEntries(Object.entries(timeNumbers).map(([k, v]) => ([v, k])));
    // const reverseTimeDigits = Object.fromEntries(Object.entries(timeDigits).map(([k, v]) => ([v, k])));

    // const cleanTimerValue = timerValue.replace(/\u200B|!/g, '');
    const cleanTimerValue = timerValue.replace(/\u200B/g, '');
    // console.log(`XXXXX TIMER CONVERTER START: ${cleanTimerValue}`);

    // use .hasOwnProperty bc checks for existances. if using reverseTimeDigits[cleanTimerValue] and return value is 0, might give false since 0 is falsly.
    if(reverseTimeNumbers.hasOwnProperty(cleanTimerValue)) return reverseTimeNumbers[cleanTimerValue];

    let workingStringArray = cleanTimerValue.split('').reverse();
    // console.log(`XXXXX TIMER CONVERTER WORKING ARRAY: ${workingStringArray}`);

    // reduce takes an array and usually adds all elements to the first one. ususally just sets acc as first element
    // then char becomes next and adds it to acc. in this case at the end of the fn we pass in acc=0 instead so we
    // can modify char before adding. can also call idx
    const sum = workingStringArray.reduce((acc, char, idx) => acc + Math.pow(10, idx) * reverseTimeDigits[char], 0);

    // console.log(`XXXXX TIMER CONVERTER FINAL: ${sum}`);

    return sum;
}

function decodeAndValidateFake(input, newNum) {
    // checks if any other char besides A–Z, !, \u200B, circled numbers (⓪, ①–⑳, ㉑–㉟, ㊱–㊿), LF (\n) and CR, (\r)
    input = input.trim();
    const firstCheck = input.replace(/[ADEHIMNRSUY\u200B!\u24EA\u2460-\u2473\u3251-\u325F\u32B1-\u32BF\r\n]/g, '');
    if (firstCheck.length > 0) return {ok: false, message: 'modified input'};

    const lines = input.split(/\r\n|\r|\n/);
    if (lines.length !== 3) return {ok: false, message: 'modified input'};

    const userTitleValue = lines[0];
    const userDifficultyValue = lines[1];
    const userGoodTime = lines[2].includes('!') ? '!':'';
    const userTimerValue = newNum; ///////!!!!!!!!!!!

    // get title number
    if(!userTitleValue.replace(/\u200B/g, '') || !reverseSecurityCodeMines.hasOwnProperty(userTitleValue)) return {ok: false, message:'modified input'};
    let userTtileNumberValue = reverseSecurityCodeMines[userTitleValue];

    // get difficulty number, strippedDifficulty
    let strippedDifficuty = userDifficultyValue.replace(/\u200B/g, '').toLowerCase();
    if(!strippedDifficuty || !['easy','medium','hard'].includes(strippedDifficuty)) return {ok: false, message:'modified input'};
    let userDifficultyNumberValue;

    switch (strippedDifficuty) {
        case 'easy':
            userDifficultyNumberValue = reverseSecurityCodeEasy[userDifficultyValue];
            break;
        case 'medium':
            userDifficultyNumberValue = reverseSecurityCodeMedium[userDifficultyValue];
            break;
        case 'hard':
        default:
            userDifficultyNumberValue = reverseSecurityCodeHard[userDifficultyValue];
            break;
    }

    // get timer number, timer
    // console.log(`XXXXXXXXXXXXXXXXX FOR BAD, LOOKING AT TIME VALUE: ${userTimerValue}, ${userTimerValue.length}`);
    // let fjdslkfjdsklfjsl = userTimerValue.replace(/\u200B/g, '');
    // console.log(`XXXXXXXXXXXXXXXXX CHECK LENGTH AFTER STRIPPING /u...: ${fjdslkfjdsklfjsl}, ${fjdslkfjdsklfjsl.length}`);
    // console.log(`XXXXXXXXXXXXXXXXX CHECK BOOL: ${!fjdslkfjdsklfjsl}`);
    let reverseSecurityCodeTime = reverseSecurityCodeTimeFunctionNormal(userTimerValue.replace(/\u200B/g, ''));
    // console.log(`XXXXXXXXXXXXXXXXX LOOKING AT WHAT THAT GIVES IN DICT: ${reverseSecurityCodeTime.hasOwnProperty(userTimerValue)}`);
    if(!userTimerValue.replace(/\u200B/g, '') || !reverseSecurityCodeTime.hasOwnProperty(userTimerValue)) return {ok: false, message: 'modified input'};
    let userTimerNumberValue = reverseSecurityCodeTime[userTimerValue];
    let strippedTimer = timerNumbersToNumber(userTimerValue); // timer as int

    for(let salt of pseudoSalt) {
        const [possibleHundredsDigit, possibleTensDigit, possibleOnesDigit] = encode(strippedDifficuty, strippedTimer, userGoodTime, salt); 

        // console.log(`encode params: difficulty="${strippedDifficuty}", timer="${strippedTimer}", goodTime="${userGoodTime}", salt="${salt}"`);
        // console.log(`Encoded digits: ${possibleHundredsDigit} ${possibleTensDigit} ${possibleOnesDigit}`);
        // console.log(`User digits:    ${userTtileNumberValue} ${userDifficultyNumberValue} ${userTimerNumberValue}`);

        if(possibleHundredsDigit === userTtileNumberValue && possibleTensDigit === userDifficultyNumberValue && possibleOnesDigit === userTimerNumberValue) return {ok: true, message: 'valid attempt'};
    }

    return {ok: false, message: 'invalid attempt'};

}

function decodeAndValidate(input) {
    // checks if any other char besides A–Z, !, \u200B, circled numbers (⓪, ①–⑳, ㉑–㉟, ㊱–㊿), LF (\n) and CR, (\r)
    input = input.trim();
    const firstCheck = input.replace(/[ADEHIMNRSUY\u200B!\u24EA\u2460-\u2473\u3251-\u325F\u32B1-\u32BF\r\n]/g, '');
    if (firstCheck.length > 0) return {ok: false, message: 'modified input'};

    const lines = input.split(/\r\n|\r|\n/);
    if (lines.length !== 3) return {ok: false, message: 'modified input'};

    const userTitleValue = lines[0];
    const userDifficultyValue = lines[1];
    const userGoodTime = lines[2].includes('!') ? '!':'';
    const userTimerValue = lines[2].replace('!', '');

    // get title number
    if(!userTitleValue.replace(/\u200B/g, '') || !reverseSecurityCodeMines.hasOwnProperty(userTitleValue)) return {ok: false, message:'modified input'};
    let userTtileNumberValue = reverseSecurityCodeMines[userTitleValue];

    // get difficulty number, strippedDifficulty
    let strippedDifficuty = userDifficultyValue.replace(/\u200B/g, '').toLowerCase();
    if(!strippedDifficuty || !['easy','medium','hard'].includes(strippedDifficuty)) return {ok: false, message:'modified input'};
    let userDifficultyNumberValue;

    switch (strippedDifficuty) {
        case 'easy':
            userDifficultyNumberValue = reverseSecurityCodeEasy[userDifficultyValue];
            break;
        case 'medium':
            userDifficultyNumberValue = reverseSecurityCodeMedium[userDifficultyValue];
            break;
        case 'hard':
        default:
            userDifficultyNumberValue = reverseSecurityCodeHard[userDifficultyValue];
            break;
    }

    // get timer number, timer
    // console.log(`XXXXXXXXXXXXXXXXX FOR BAD, LOOKING AT TIME VALUE: ${userTimerValue}, ${userTimerValue.length}`);
    let fjdslkfjdsklfjsl = userTimerValue.replace(/\u200B/g, '');
    // console.log(`XXXXXXXXXXXXXXXXX CHECK LENGTH AFTER STRIPPING /u...: ${fjdslkfjdsklfjsl}, ${fjdslkfjdsklfjsl.length}`);
    // console.log(`XXXXXXXXXXXXXXXXX CHECK BOOL: ${!fjdslkfjdsklfjsl}`);
    let reverseSecurityCodeTime = reverseSecurityCodeTimeFunctionNormal(userTimerValue.replace(/\u200B/g, ''));
    // console.log(`XXXXXXXXXXXXXXXXX LOOKING AT WHAT THAT GIVES IN DICT: ${reverseSecurityCodeTime.hasOwnProperty(userTimerValue)}`);
    if(!userTimerValue.replace(/\u200B/g, '') || !reverseSecurityCodeTime.hasOwnProperty(userTimerValue)) return {ok: false, message: 'modified input'};
    let userTimerNumberValue = reverseSecurityCodeTime[userTimerValue];
    let strippedTimer = timerNumbersToNumber(userTimerValue); // timer as int

    for(let salt of pseudoSalt) {
        const [possibleHundredsDigit, possibleTensDigit, possibleOnesDigit] = encode(strippedDifficuty, strippedTimer, userGoodTime, salt); 

        // console.log(`encode params: difficulty="${strippedDifficuty}", timer="${strippedTimer}", goodTime="${userGoodTime}", salt="${salt}"`);
        // console.log(`Encoded digits: ${possibleHundredsDigit} ${possibleTensDigit} ${possibleOnesDigit}`);
        // console.log(`User digits:    ${userTtileNumberValue} ${userDifficultyNumberValue} ${userTimerNumberValue}`);

        if(possibleHundredsDigit === userTtileNumberValue && possibleTensDigit === userDifficultyNumberValue && possibleOnesDigit === userTimerNumberValue) return {ok: true, message: 'valid attempt'};
    }

    return {ok: false, message: 'invalid attempt'};

}

const circledNumbers = [
    "⓪", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳", "㉑", "㉒", "㉓", "㉔", "㉕", "㉖", "㉗", "㉘", "㉙", "㉚", "㉛", "㉜", "㉝", "㉞", "㉟", "㊱", "㊲", "㊳", "㊴", "㊵", "㊶", "㊷", "㊸", "㊹", "㊺", "㊻", "㊼", "㊽", "㊾", "㊿", "⑤①", "⑤②", "⑤③", "⑤④", "⑤⑤", "⑤⑥", "⑤⑦", "⑤⑧", "⑤⑨", "⑥⓪", "⑥①", "⑥②", "⑥③", "⑥④", "⑥⑤", "⑥⑥", "⑥⑦", "⑥⑧", "⑥⑨", "⑦⓪", "⑦①", "⑦②", "⑦③", "⑦④", "⑦⑤", "⑦⑥", "⑦⑦", "⑦⑧", "⑦⑨", "⑧⓪", "⑧①", "⑧②", "⑧③", "⑧④", "⑧⑤", "⑧⑥", "⑧⑦", "⑧⑧", "⑧⑨", "⑨⓪", "⑨①", "⑨②", "⑨③", "⑨④", "⑨⑤", "⑨⑥", "⑨⑦", "⑨⑧", "⑨⑨",
    "①⓪⓪", "①⓪①", "①⓪②", "①⓪③", "①⓪④", "①⓪⑤", "①⓪⑥", "①⓪⑦", "①⓪⑧", "①⓪⑨", "①①⓪", "①①①", "①①②", "①①③", "①①④", "①①⑤", "①①⑥", "①①⑦", "①①⑧", "①①⑨", "①②⓪", "①②①", "①②②", "①②③", "①②④", "①②⑤", "①②⑥", "①②⑦", "①②⑧", "①②⑨", "①③⓪", "①③①", "①③②", "①③③", "①③④", "①③⑤", "①③⑥", "①③⑦", "①③⑧", "①③⑨", "①④⓪", "①④①", "①④②", "①④③", "①④④", "①④⑤", "①④⑥", "①④⑦", "①④⑧", "①④⑨", "①⑤⓪", "①⑤①", "①⑤②", "①⑤③", "①⑤④", "①⑤⑤", "①⑤⑥", "①⑤⑦", "①⑤⑧", "①⑤⑨", "①⑥⓪", "①⑥①", "①⑥②", "①⑥③", "①⑥④", "①⑥⑤", "①⑥⑥", "①⑥⑦", "①⑥⑧", "①⑥⑨", "①⑦⓪", "①⑦①", "①⑦②", "①⑦③", "①⑦④", "①⑦⑤", "①⑦⑥", "①⑦⑦", "①⑦⑧", "①⑦⑨", "①⑧⓪", "①⑧①", "①⑧②", "①⑧③", "①⑧④", "①⑧⑤", "①⑧⑥", "①⑧⑦", "①⑧⑧", "①⑧⑨", "①⑨⓪", "①⑨①", "①⑨②", "①⑨③", "①⑨④", "①⑨⑤", "①⑨⑥", "①⑨⑦", "①⑨⑧", "①⑨⑨",
    "②⓪⓪", "②⓪①", "②⓪②", "②⓪③", "②⓪④", "②⓪⑤", "②⓪⑥", "②⓪⑦", "②⓪⑧", "②⓪⑨", "②①⓪", "②①①", "②①②", "②①③", "②①④", "②①⑤", "②①⑥", "②①⑦", "②①⑧", "②①⑨", "②②⓪", "②②①", "②②②", "②②③", "②②④", "②②⑤", "②②⑥", "②②⑦", "②②⑧", "②②⑨", "②③⓪", "②③①", "②③②", "②③③", "②③④", "②③⑤", "②③⑥", "②③⑦", "②③⑧", "②③⑨", "②④⓪", "②④①", "②④②", "②④③", "②④④", "②④⑤", "②④⑥", "②④⑦", "②④⑧", "②④⑨", "②⑤⓪", "②⑤①", "②⑤②", "②⑤③", "②⑤④", "②⑤⑤", "②⑤⑥", "②⑤⑦", "②⑤⑧", "②⑤⑨", "②⑥⓪", "②⑥①", "②⑥②", "②⑥③", "②⑥④", "②⑥⑤", "②⑥⑥", "②⑥⑦", "②⑥⑧", "②⑥⑨", "②⑦⓪", "②⑦①", "②⑦②", "②⑦③", "②⑦④", "②⑦⑤", "②⑦⑥", "②⑦⑦", "②⑦⑧", "②⑦⑨", "②⑧⓪", "②⑧①", "②⑧②", "②⑧③", "②⑧④", "②⑧⑤", "②⑧⑥", "②⑧⑦", "②⑧⑧", "②⑧⑨", "②⑨⓪", "②⑨①", "②⑨②", "②⑨③", "②⑨④", "②⑨⑤", "②⑨⑥", "②⑨⑦", "②⑨⑧", "②⑨⑨",
    "③⓪⓪", "③⓪①", "③⓪②", "③⓪③", "③⓪④", "③⓪⑤", "③⓪⑥", "③⓪⑦", "③⓪⑧", "③⓪⑨", "③①⓪", "③①①", "③①②", "③①③", "③①④", "③①⑤", "③①⑥", "③①⑦", "③①⑧", "③①⑨", "③②⓪", "③②①", "③②②", "③②③", "③②④", "③②⑤", "③②⑥", "③②⑦", "③②⑧", "③②⑨", "③③⓪", "③③①", "③③②", "③③③", "③③④", "③③⑤", "③③⑥", "③③⑦", "③③⑧", "③③⑨", "③④⓪", "③④①", "③④②", "③④③", "③④④", "③④⑤", "③④⑥", "③④⑦", "③④⑧", "③④⑨", "③⑤⓪", "③⑤①", "③⑤②", "③⑤③", "③⑤④", "③⑤⑤", "③⑤⑥", "③⑤⑦", "③⑤⑧", "③⑤⑨", "③⑥⓪", "③⑥①", "③⑥②", "③⑥③", "③⑥④", "③⑥⑤", "③⑥⑥", "③⑥⑦", "③⑥⑧", "③⑥⑨", "③⑦⓪", "③⑦①", "③⑦②", "③⑦③", "③⑦④", "③⑦⑤", "③⑦⑥", "③⑦⑦", "③⑦⑧", "③⑦⑨", "③⑧⓪", "③⑧①", "③⑧②", "③⑧③", "③⑧④", "③⑧⑤", "③⑧⑥", "③⑧⑦", "③⑧⑧", "③⑧⑨", "③⑨⓪", "③⑨①", "③⑨②", "③⑨③", "③⑨④", "③⑨⑤", "③⑨⑥", "③⑨⑦", "③⑨⑧", "③⑨⑨",
    "④⓪⓪", "④⓪①", "④⓪②", "④⓪③", "④⓪④", "④⓪⑤", "④⓪⑥", "④⓪⑦", "④⓪⑧", "④⓪⑨", "④①⓪", "④①①", "④①②", "④①③", "④①④", "④①⑤", "④①⑥", "④①⑦", "④①⑧", "④①⑨", "④②⓪", "④②①", "④②②", "④②③", "④②④", "④②⑤", "④②⑥", "④②⑦", "④②⑧", "④②⑨", "④③⓪", "④③①", "④③②", "④③③", "④③④", "④③⑤", "④③⑥", "④③⑦", "④③⑧", "④③⑨", "④④⓪", "④④①", "④④②", "④④③", "④④④", "④④⑤", "④④⑥", "④④⑦", "④④⑧", "④④⑨", "④⑤⓪", "④⑤①", "④⑤②", "④⑤③", "④⑤④", "④⑤⑤", "④⑤⑥", "④⑤⑦", "④⑤⑧", "④⑤⑨", "④⑥⓪", "④⑥①", "④⑥②", "④⑥③", "④⑥④", "④⑥⑤", "④⑥⑥", "④⑥⑦", "④⑥⑧", "④⑥⑨", "④⑦⓪", "④⑦①", "④⑦②", "④⑦③", "④⑦④", "④⑦⑤", "④⑦⑥", "④⑦⑦", "④⑦⑧", "④⑦⑨", "④⑧⓪", "④⑧①", "④⑧②", "④⑧③", "④⑧④", "④⑧⑤", "④⑧⑥", "④⑧⑦", "④⑧⑧", "④⑧⑨", "④⑨⓪", "④⑨①", "④⑨②", "④⑨③", "④⑨④", "④⑨⑤", "④⑨⑥", "④⑨⑦", "④⑨⑧", "④⑨⑨",
    "⑤⓪⓪", "⑤⓪①", "⑤⓪②", "⑤⓪③", "⑤⓪④", "⑤⓪⑤", "⑤⓪⑥", "⑤⓪⑦", "⑤⓪⑧", "⑤⓪⑨", "⑤①⓪", "⑤①①", "⑤①②", "⑤①③", "⑤①④", "⑤①⑤", "⑤①⑥", "⑤①⑦", "⑤①⑧", "⑤①⑨", "⑤②⓪", "⑤②①", "⑤②②", "⑤②③", "⑤②④", "⑤②⑤", "⑤②⑥", "⑤②⑦", "⑤②⑧", "⑤②⑨", "⑤③⓪", "⑤③①", "⑤③②", "⑤③③", "⑤③④", "⑤③⑤", "⑤③⑥", "⑤③⑦", "⑤③⑧", "⑤③⑨", "⑤④⓪", "⑤④①", "⑤④②", "⑤④③", "⑤④④", "⑤④⑤", "⑤④⑥", "⑤④⑦", "⑤④⑧", "⑤④⑨", "⑤⑤⓪", "⑤⑤①", "⑤⑤②", "⑤⑤③", "⑤⑤④", "⑤⑤⑤", "⑤⑤⑥", "⑤⑤⑦", "⑤⑤⑧", "⑤⑤⑨", "⑤⑥⓪", "⑤⑥①", "⑤⑥②", "⑤⑥③", "⑤⑥④", "⑤⑥⑤", "⑤⑥⑥", "⑤⑥⑦", "⑤⑥⑧", "⑤⑥⑨", "⑤⑦⓪", "⑤⑦①", "⑤⑦②", "⑤⑦③", "⑤⑦④", "⑤⑦⑤", "⑤⑦⑥", "⑤⑦⑦", "⑤⑦⑧", "⑤⑦⑨", "⑤⑧⓪", "⑤⑧①", "⑤⑧②", "⑤⑧③", "⑤⑧④", "⑤⑧⑤", "⑤⑧⑥", "⑤⑧⑦", "⑤⑧⑧", "⑤⑧⑨", "⑤⑨⓪", "⑤⑨①", "⑤⑨②", "⑤⑨③", "⑤⑨④", "⑤⑨⑤", "⑤⑨⑥", "⑤⑨⑦", "⑤⑨⑧", "⑤⑨⑨",
    "⑥⓪⓪", "⑥⓪①", "⑥⓪②", "⑥⓪③", "⑥⓪④", "⑥⓪⑤", "⑥⓪⑥", "⑥⓪⑦", "⑥⓪⑧", "⑥⓪⑨", "⑥①⓪", "⑥①①", "⑥①②", "⑥①③", "⑥①④", "⑥①⑤", "⑥①⑥", "⑥①⑦", "⑥①⑧", "⑥①⑨", "⑥②⓪", "⑥②①", "⑥②②", "⑥②③", "⑥②④", "⑥②⑤", "⑥②⑥", "⑥②⑦", "⑥②⑧", "⑥②⑨", "⑥③⓪", "⑥③①", "⑥③②", "⑥③③", "⑥③④", "⑥③⑤", "⑥③⑥", "⑥③⑦", "⑥③⑧", "⑥③⑨", "⑥④⓪", "⑥④①", "⑥④②", "⑥④③", "⑥④④", "⑥④⑤", "⑥④⑥", "⑥④⑦", "⑥④⑧", "⑥④⑨", "⑥⑤⓪", "⑥⑤①", "⑥⑤②", "⑥⑤③", "⑥⑤④", "⑥⑤⑤", "⑥⑤⑥", "⑥⑤⑦", "⑥⑤⑧", "⑥⑤⑨", "⑥⑥⓪", "⑥⑥①", "⑥⑥②", "⑥⑥③", "⑥⑥④", "⑥⑥⑤", "⑥⑥⑥", "⑥⑥⑦", "⑥⑥⑧", "⑥⑥⑨", "⑥⑦⓪", "⑥⑦①", "⑥⑦②", "⑥⑦③", "⑥⑦④", "⑥⑦⑤", "⑥⑦⑥", "⑥⑦⑦", "⑥⑦⑧", "⑥⑦⑨", "⑥⑧⓪", "⑥⑧①", "⑥⑧②", "⑥⑧③", "⑥⑧④", "⑥⑧⑤", "⑥⑧⑥", "⑥⑧⑦", "⑥⑧⑧", "⑥⑧⑨", "⑥⑨⓪", "⑥⑨①", "⑥⑨②", "⑥⑨③", "⑥⑨④", "⑥⑨⑤", "⑥⑨⑥", "⑥⑨⑦", "⑥⑨⑧", "⑥⑨⑨",
    "⑦⓪⓪", "⑦⓪①", "⑦⓪②", "⑦⓪③", "⑦⓪④", "⑦⓪⑤", "⑦⓪⑥", "⑦⓪⑦", "⑦⓪⑧", "⑦⓪⑨", "⑦①⓪", "⑦①①", "⑦①②", "⑦①③", "⑦①④", "⑦①⑤", "⑦①⑥", "⑦①⑦", "⑦①⑧", "⑦①⑨", "⑦②⓪", "⑦②①", "⑦②②", "⑦②③", "⑦②④", "⑦②⑤", "⑦②⑥", "⑦②⑦", "⑦②⑧", "⑦②⑨", "⑦③⓪", "⑦③①", "⑦③②", "⑦③③", "⑦③④", "⑦③⑤", "⑦③⑥", "⑦③⑦", "⑦③⑧", "⑦③⑨", "⑦④⓪", "⑦④①", "⑦④②", "⑦④③", "⑦④④", "⑦④⑤", "⑦④⑥", "⑦④⑦", "⑦④⑧", "⑦④⑨", "⑦⑤⓪", "⑦⑤①", "⑦⑤②", "⑦⑤③", "⑦⑤④", "⑦⑤⑤", "⑦⑤⑥", "⑦⑤⑦", "⑦⑤⑧", "⑦⑤⑨", "⑦⑥⓪", "⑦⑥①", "⑦⑥②", "⑦⑥③", "⑦⑥④", "⑦⑥⑤", "⑦⑥⑥", "⑦⑥⑦", "⑦⑥⑧", "⑦⑥⑨", "⑦⑦⓪", "⑦⑦①", "⑦⑦②", "⑦⑦③", "⑦⑦④", "⑦⑦⑤", "⑦⑦⑥", "⑦⑦⑦", "⑦⑦⑧", "⑦⑦⑨", "⑦⑧⓪", "⑦⑧①", "⑦⑧②", "⑦⑧③", "⑦⑧④", "⑦⑧⑤", "⑦⑧⑥", "⑦⑧⑦", "⑦⑧⑧", "⑦⑧⑨", "⑦⑨⓪", "⑦⑨①", "⑦⑨②", "⑦⑨③", "⑦⑨④", "⑦⑨⑤", "⑦⑨⑥", "⑦⑨⑦", "⑦⑨⑧", "⑦⑨⑨",
    "⑧⓪⓪", "⑧⓪①", "⑧⓪②", "⑧⓪③", "⑧⓪④", "⑧⓪⑤", "⑧⓪⑥", "⑧⓪⑦", "⑧⓪⑧", "⑧⓪⑨", "⑧①⓪", "⑧①①", "⑧①②", "⑧①③", "⑧①④", "⑧①⑤", "⑧①⑥", "⑧①⑦", "⑧①⑧", "⑧①⑨", "⑧②⓪", "⑧②①", "⑧②②", "⑧②③", "⑧②④", "⑧②⑤", "⑧②⑥", "⑧②⑦", "⑧②⑧", "⑧②⑨", "⑧③⓪", "⑧③①", "⑧③②", "⑧③③", "⑧③④", "⑧③⑤", "⑧③⑥", "⑧③⑦", "⑧③⑧", "⑧③⑨", "⑧④⓪", "⑧④①", "⑧④②", "⑧④③", "⑧④④", "⑧④⑤", "⑧④⑥", "⑧④⑦", "⑧④⑧", "⑧④⑨", "⑧⑤⓪", "⑧⑤①", "⑧⑤②", "⑧⑤③", "⑧⑤④", "⑧⑤⑤", "⑧⑤⑥", "⑧⑤⑦", "⑧⑤⑧", "⑧⑤⑨", "⑧⑥⓪", "⑧⑥①", "⑧⑥②", "⑧⑥③", "⑧⑥④", "⑧⑥⑤", "⑧⑥⑥", "⑧⑥⑦", "⑧⑥⑧", "⑧⑥⑨", "⑧⑦⓪", "⑧⑦①", "⑧⑦②", "⑧⑦③", "⑧⑦④", "⑧⑦⑤", "⑧⑦⑥", "⑧⑦⑦", "⑧⑦⑧", "⑧⑦⑨", "⑧⑧⓪", "⑧⑧①", "⑧⑧②", "⑧⑧③", "⑧⑧④", "⑧⑧⑤", "⑧⑧⑥", "⑧⑧⑦", "⑧⑧⑧", "⑧⑧⑨", "⑧⑨⓪", "⑧⑨①", "⑧⑨②", "⑧⑨③", "⑧⑨④", "⑧⑨⑤", "⑧⑨⑥", "⑧⑨⑦", "⑧⑨⑧", "⑧⑨⑨",
    "⑨⓪⓪", "⑨⓪①", "⑨⓪②", "⑨⓪③", "⑨⓪④", "⑨⓪⑤", "⑨⓪⑥", "⑨⓪⑦", "⑨⓪⑧", "⑨⓪⑨", "⑨①⓪", "⑨①①", "⑨①②", "⑨①③", "⑨①④", "⑨①⑤", "⑨①⑥", "⑨①⑦", "⑨①⑧", "⑨①⑨", "⑨②⓪", "⑨②①", "⑨②②", "⑨②③", "⑨②④", "⑨②⑤", "⑨②⑥", "⑨②⑦", "⑨②⑧", "⑨②⑨", "⑨③⓪", "⑨③①", "⑨③②", "⑨③③", "⑨③④", "⑨③⑤", "⑨③⑥", "⑨③⑦", "⑨③⑧", "⑨③⑨", "⑨④⓪", "⑨④①", "⑨④②", "⑨④③", "⑨④④", "⑨④⑤", "⑨④⑥", "⑨④⑦", "⑨④⑧", "⑨④⑨", "⑨⑤⓪", "⑨⑤①", "⑨⑤②", "⑨⑤③", "⑨⑤④", "⑨⑤⑤", "⑨⑤⑥", "⑨⑤⑦", "⑨⑤⑧", "⑨⑤⑨", "⑨⑥⓪", "⑨⑥①", "⑨⑥②", "⑨⑥③", "⑨⑥④", "⑨⑥⑤", "⑨⑥⑥", "⑨⑥⑦", "⑨⑥⑧", "⑨⑥⑨", "⑨⑦⓪", "⑨⑦①", "⑨⑦②", "⑨⑦③", "⑨⑦④", "⑨⑦⑤", "⑨⑦⑥", "⑨⑦⑦", "⑨⑦⑧", "⑨⑦⑨", "⑨⑧⓪", "⑨⑧①", "⑨⑧②", "⑨⑧③", "⑨⑧④", "⑨⑧⑤", "⑨⑧⑥", "⑨⑧⑦", "⑨⑧⑧", "⑨⑧⑨", "⑨⑨⓪", "⑨⑨①", "⑨⑨②", "⑨⑨③", "⑨⑨④", "⑨⑨⑤", "⑨⑨⑥", "⑨⑨⑦", "⑨⑨⑧", "⑨⑨⑨"
  ];

const validationButton = document.getElementById('validationButton');

validationButton.addEventListener('click', () => {
    const input = document.getElementById('userInput').value;
    let count = 0;
    for (char of circledNumbers){
        const result = decodeAndValidateFake(input, char); // expected to return { ok: bool, message: string }
        console.log(`${char} ${result.ok}`);
        if(!result.ok) count++;
    }
    console.log(`number of collisions: ${count}`);

    const result = decodeAndValidate(input); // expected to return { ok: bool, message: string }

    const msgBox = document.getElementById('message');
    msgBox.textContent = result.message;
    msgBox.className = result.ok ? 'ok' : 'fail';
    console.log(`${char} ${result.ok}`);
});





//////// add a second 3 digit number using the other blank symbol, will get 6 digits
/////// => 100 hashes shouldnt collide as much
