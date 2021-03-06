console.log('The bot is starting');

const Twit = require('twit');
const weather = require('weather-js');
const fs = require('fs');
const badwordsArray = require('badwords/array');

const config = require('./config');

const T = new Twit(config);

// --------------- Gather some info first --------------
// Get blocked IDs
let blockedIDs = [];

getMutedList();

// --------------- Retweet #yeg hashtag --------------
// Choose 1 tweet every 20 mins, every 3rd tweet guaranteed media
const retweetInterval = setInterval(retweetYeg, 1000*60*20);
let tweetCount = 1;

function retweetYeg() {
  const params = {
    q: '#yeg',
    count: 20
  }

  T.get('search/tweets', params, gotData);

  function gotData(err, data, response) {
    const tweets = data.statuses;
    // If tweetCount is 1 or 2, post first clean tweet
    if (tweetCount === 1 || tweetCount === 2) {
      for (let i = 0; i < tweets.length; i++) {
        const retweet = tweets[i].id_str;
        const text = tweets[i].text;
        const userID = tweets[i].user.id;
        const textArray = text.toLowerCase().split(' ');

        if (checkIfClean(textArray) && checkIfMuted(blockedIDs, userID)) {
          T.post('statuses/retweet/:id', { id: retweet }, function (err, data, response) {
            console.log(`Retweeted tweet with id of: ${retweet}`);
          })
          tweetCount++;
          break;
        } else {
          console.log(`Tweet contains foul language or User ${userID} is muted`);
        }
      }
    // else if tweetCount is 3, post a tweet with media
    } else if (tweetCount == 3) {
      for (let i = 0; i < tweets.length; i++) {
        if (tweets[i].entities.media != undefined) {
          const retweet = tweets[i].id_str;
          const text = tweets[i].text;
          const userID = tweets[i].user.id;
          const textArray = text.toLowerCase().split(' ');

          if (checkIfClean(textArray) && checkIfMuted(blockedIDs, userID)) {
            T.post('statuses/retweet/:id', { id: retweet }, function (err, data, response) {
              console.log(`Retweeted tweet with id of: ${retweet}`);
            });
            tweetCount = 1;
            break;
          } else {
            console.log(`Tweet contains foul language or User ${userID} is muted`);
          }
        }
      }
    }
  }
}



// ------------- POST WEATHER TWEET ---------------

const weatherInterval = setInterval(checkTime, 1000*60*60); // Every hour

function checkTime() {
  const d = new Date();
  const hour = d.getHours();

  if (hour == 13 || hour == 19 || hour == 1) {
    tweetWeather();
  }
}

function tweetWeather() {
  weather.find({search: 'Edmonton, AB', degreeType: 'C'}, function(err, data) {
    if(err) {
      console.log(err);
    } else {
      const temp = data[0].current.temperature;
      const skytext = data[0].current.skytext;
      const num = Math.floor(Math.random() * 11);
      let img;
      let tweetText;

      if (temp <= -20) {
        img = `cold${num}`;
        tweetText = `❄️BRRRRR!!❄️ It is ${temp}°C today, stay inside and keep warm! #yeg #yegbot`;
      } else {
        if (skytext === 'Sunny' || skytext === 'Clear' || skytext === 'Mostly Sunny' || skytext === 'Partly Sunny' || skytext === 'Mostly Clear') {
          img = `sunny${num}`;
          tweetText = `☀️☀️ The sun is shining today! Currently ${temp}°C, get out there and enjoy it! #yeg #yegbot`;
        } else if (skytext === 'Rain' || skytext === 'Light Rain' || skytext === 'Showers' || skytext === 'Rain Showers') {
          img = `rain${num}`;
          tweetText = `Might want to pack an umbrella.☂️ ${temp}°C and calling for rain. 🌧️ #yeg #yegbot`;
        } else if (skytext === 'Cloudy' || skytext === 'Mostly Cloudy' || skytext === 'Partly Cloudy') {
          img = `cloudy${num}`;
          tweetText =`${temp}°C and cloudy today. No meatballs though, just clouds. ☁️🌥️ #yeg #yegbot`;
        } else if (skytext === 'Snow' || skytext === 'Blizzard' || skytext === 'Light Snow') {
          img = `snow${num}`;
          tweetText = `❄️❄️ Bundle up and grab the shovel! ${temp}°C and snow. #yeg #yegbot`;
        } else if (skytext === 'Thunderstorm' || skytext === 'Scattered Thunderstorms') {
          img = `thunderstorms${num}`;
          tweetText = `Curl up with a blanket and a movie. ${temp}°C and ⛈️thunderstorms⛈️ today. #yeg #yegbot`;
        } else {
          img = 'default'
          tweetText = `Looks like ${temp}°C and ${skytext.toLowerCase()} today #yeg #yegbot`;
        }
      }

      const imagePath = `img/${img}.gif`;

      const b64content = fs.readFileSync(imagePath, { encoding: 'base64' })

      // first we must post the media to Twitter
      T.post('media/upload', { media_data: b64content }, function (err, data, response) {
        const mediaIdStr = data.media_id_string
        // now we can reference the media and post a tweet (media will attach to the tweet)
        const params = { status: tweetText, media_ids: [mediaIdStr] }

        T.post('statuses/update', params, function (err, data, response) {
          console.log('**Tweeted daily weather**');
        });
      });
    }
  });
}


// --------- Retweet #yegbot tweet ---------

// Set up user stream
const stream = T.stream('statuses/filter', { track: '#yegbot', language: 'en' });

// Anytime someone hashtag #yegbot
stream.on('tweet', tweetEvent);

function tweetEvent(eventMsg) {
  console.log('Tweet with #yegbot entered the stream');
  //console.log(eventMsg);
  const accName = eventMsg.user.screen_name.toLowerCase();
  const userID = eventMsg.user.id;
  const tweetID = eventMsg.id_str;
  const text = eventMsg.text;
  const textArray = text.toLowerCase().split(' ');

  // If both clean, user not blocked & directed at yegbot, retweet it. Else, say no
  if (checkIfClean(textArray) && accName !== 'yegbot' && checkIfMuted(blockedIDs, userID)) {
    T.post('statuses/retweet/:id', { id: tweetID }, function (err, data, response) {
      console.log(`Retweeted tagged tweet from ${accName} with id of: ${tweetID}`);
    })
  } else {
    console.log(`Tweet from ${accName} contained foul language, from yegbot, and/or muted, not retweeting`);
  }
}


function getMutedList() {
  console.log("Getting muted users list");
  T.get('mutes/users/ids', gotData);

  function gotData(err, data, response) {
    console.log("List received");
    blockedIDs = data.ids;
  }
}

function checkIfMuted(mutedArray, uID) {
  if (mutedArray.indexOf(uID) > -1) {
    console.log("User muted");
    return false;
  } else {
    console.log("User not muted")
    return true;
  }
}

function checkIfClean(txtArr) {
  for (let i = 0; i < txtArr.length; i++) {
    if (badwordsArray.indexOf(txtArr[i]) !== -1) {
      return false;
    }
  }
  return true;
}

// Check tweet for foul language
// let cleanTweet = true;
// for (let i = 0; i < textArray.length; i++) {
//   if (badwordsArray.indexOf(textArray[i]) !== -1) {
//     cleanTweet = false;
//     break;
//   }
// }