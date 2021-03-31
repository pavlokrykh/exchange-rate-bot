const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const fs = require('fs');

const token = '1797490881:AAEi_SC4yOC924eevsx8yrTZ4nfjsb0oRyY'
const bot = new TelegramBot(token, {polling: true});


const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const width = 400;
const height = 400;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });


const getRates = async (curr) => {
    try {
        let time = Date.now()/60000;
    	const response = await fetch(`https://api.exchangeratesapi.io/latest?base=${curr}`);
    	const data = await response.json();
        data['time']=time.toString().split('.')[0];
        fs.writeFile('rates.json', JSON.stringify(data), function(err) {
            if (err) throw err;
            console.log('List updated.');
        });
        return data;
    } catch (err) {
       console.log(err);
    };
};
getRates('USD');

function printRates(json){
    let r = '';
    for(var i in json['rates']){
        r = r + i+": "+json['rates'][i].toFixed(2)+'\n';
    };
    return r;
};

const commands = "Here are my commands:\n"+
"/list - returns all available rates;\n"+
"/exchange (amount to exchange) (base currency) to (target currency)\n"+
"Example: /exchange 10 USD to CAD\n"+
"/history (base currency)/(target currency) for (amount of days)\n"+
"Example: /history USD/CAD for 7 days";

bot.onText(/\/start/, (msg) =>{
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, 'Hello, I am a currency exchange rate bot.\n'+commands);
});
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if(msg.text[0] != '/'){
        bot.sendMessage(chatId, commands);
    }
});


bot.onText(/\/l(|i)st\b/, async (msg) => {
    const chatId = msg.chat.id;

    if(msg.text == '/list'||'/lst'){
        let rates = JSON.parse(fs.readFileSync('rates.json',  'utf-8', function readFileCallback(err, data){
            if (err){
                console.log(err);
            }
        }));
        if((Date.now()/60000).toString().split('.')[0]-rates.time>=10 || rates.rates['USD']!='1.00'){    
            getRates('USD').then(result => {
                bot.sendMessage(chatId, printRates(result));
                console.log('10 minutes passed since last update.')
            });
        } else {
            bot.sendMessage(chatId, printRates(rates));
        };
    };
});

bot.onText(/\/exchange (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    let arr = match[1].split(' ');
    let rates = JSON.parse(fs.readFileSync('rates.json',  'utf-8', function readFileCallback(err, data){
        if (err){
            console.log(err);
        };
    }));
    if(arr[2]) {
        arr[1]=arr[1].toUpperCase();
        arr[2]=arr[2].toUpperCase();
    };
    if(arr[3]) arr[3]=arr[3].toUpperCase();
    
    if(arr[1] && arr[1] in rates.rates){
        if(arr[2] == "TO"){
            getRates(arr[1]).then(result => {
                if(arr[3] in result['rates']){
                    bot.sendMessage(chatId, (result['rates'][arr[3]]*arr[0]).toFixed(2)+' '+arr[3]);
                } else {
                    bot.sendMessage(chatId, "Currency '"+arr[3]+"' is not supported.");
                };
                console.log(result['rates'][arr[3]].toFixed(2));
            });
        } else {
            getRates(arr[1]).then(result => {
                if(arr[2] in result['rates']){
                    bot.sendMessage(chatId, (result['rates'][arr[2]]*arr[0]).toFixed(2)+' '+arr[2]);
                } else {
                    bot.sendMessage(chatId, "Currency '"+arr[2]+"' is not supported.");
                };
                console.log(result['rates'][arr[2]].toFixed(2));
            });
        };
    } else {
        bot.sendMessage(chatId, "Please correct your input: \n /exchange (amount to exchange) (base currency) to (target currency)")
    };
    
});


const historyGraph = async (history, cur) => {
    let d = []
    let value = []
    let array = []
    for(j in history){
        array.push([j, history[j][cur]]);
    };
    array.sort();
    for(i in array){
        d.push(array[i][0]);
        value.push(array[i][1])
    };

    const configuration = {
      type: 'line',
      data: {
        labels: d,
        datasets: [{
          label: cur+' rates',
          data: value
        }]
      }
    };

    const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);

    fs.writeFileSync('mychart.png', imageBuffer);
};


bot.onText(/\/history (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;

    let str = match[1].split(' ');
    let base = str[0].split('/')[0].toUpperCase();
    let toCur = str[0].split('/')[1].toUpperCase();
    let num = str[2];

    let date = new Date();
    let today = date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate();

    date.setDate(date.getDate()-num);
    let startDate = date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate();
    console.log(today, startDate);
    
    let url = `https://api.exchangeratesapi.io/history?start_at=${startDate}&end_at=${today}&base=${base}&symbols=${toCur}`
    console.log(url);

    if(isNaN(num)){
        bot.sendMessage(chatId, 'Please correct your input:\n /history (base currency)/(target currency) for (amount of days)');
    } else if(num > 31){
        bot.sendMessage(chatId, 'Max amount is 31 days.');
    } else {
        fetch(url).then(result => {
            return result.json();
        }).then((data) => {
            if(data.rates){
                historyGraph(data.rates, toCur).then(photo => {
                bot.sendPhoto(chatId, 'mychart.png', {caption: `History of ${base} to ${toCur} rates for past ${num} day(s).`});
                });
            } else {
                bot.sendMessage(chatId, 'No exchange rate data is available for the selected currency.');
            };
        });
    }
});
