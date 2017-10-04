console.log('The bot is starting');

const Twit = require('twit');
const weather = require('weather-js');
const fs = require('fs');
const badwordsArray = require('badwords/array');

const config = require('./config');

const T = new Twit(config);

// --------------- Gather some info first --------------
let blockedIDs = [];

// Get blocked IDs
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

        // Check tweet for foul language
        const textArray = text.toLowerCase().split(' ');
        let cleanTweet = true;
        for (let i = 0; i < textArray.length; i++) {
          if (badwordsArray.indexOf(textArray[i]) !== -1) {
            cleanTweet = false;
            break;
          }
        }

        // If tweet is clean, retweet it
        if (cleanTweet && checkIfMuted(blockedIDs, userID)) {
          T.post('statuses/retweet/:id', { id: retweet }, function (err, data, response) {
            console.log(`Retweeted tweet with id of: ${retweet}`);
          })
          tweetCount++;
          break;
        }
      }
    // else if tweetCount is 3, post a tweet with media
    } else if (tweetCount == 3) {
      for (let i = 0; i < tweets.length; i++) {
        if (tweets[i].entities.media != undefined) {
          const retweet = tweets[i].id_str;
          const text = tweets[i].text;
          const userID = tweets[i].user.id;

          // Check tweet for foul language
          const textArray = text.toLowerCase().split(' ');
          let cleanTweet = true;
          for (let i = 0; i < textArray.length; i++) {
            if (badwordsArray.indexOf(textArray[i]) !== -1) {
              cleanTweet = false;
              break;
            }
          }

          // If tweet is clean, retweet it
          if (cleanTweet && checkIfMuted(blockedIDs, userID)) {
            T.post('statuses/retweet/:id', { id: retweet }, function (err, data, response) {
              console.log(`Retweeted tweet with id of: ${retweet}`);
            });
            tweetCount = 1;
            break;
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

      if (skytext === 'Sunny' || skytext === 'Clear' || skytext === 'Mostly Sunny' || skytext === 'Partly Sunny') {
        img = `sunny${num}`;
        tweetText = `☀️☀️ The sun is shining today! Currently ${temp}°C, get out there and enjoy it!`;
      } else if (skytext === 'Rain' || skytext === 'Light Rain' || skytext === 'Showers') {
        img = `rain${num}`;
        tweetText = `Might want to pack an umbrella.☂️ ${temp}°C and calling for rain. 🌧️`;
      } else if (skytext === 'Cloudy' || skytext === 'Mostly Cloudy' || skytext === 'Partly Cloudy') {
        img = `cloudy${num}`;
        tweetText =`${temp}°C and cloudy today. No meatballs though, just clouds. ☁️🌥️`;
      } else if (skytext === 'Snow' || skytext === 'Blizzard') {
        img = `snow${num}`;
        tweetText = `❄️❄️ Bundle up and grab the shovel! ${temp}°C and snow.`;
      } else if (skytext === 'Thunderstorm' || skytext === 'Scattered Thunderstorms') {
        img = `thunderstorms${num}`;
        tweetText = `Curl up with a blanket and a movie. ${temp}°C and ⛈️thunderstorms⛈️ today.`;
      } else {
        img = 'default'
        tweetText = `Looks like ${temp}°C and ${skytext.toLowerCase()} today`;
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


// --------- Retweet tagged tweet ---------

// Set up user stream
const stream = T.stream('user');

// Anytime someone tags @yegbot
stream.on('tweet', tweetEvent);

function tweetEvent(eventMsg) {
  console.log('Tweet entered the stream');
  //console.log(eventMsg);
  const replyTo = eventMsg.entities.user_mentions;
  const from = eventMsg.user.screen_name.toLowerCase();
  const userID = eventMsg.user.id;
  const tweetID = eventMsg.id_str;
  const text = eventMsg.text;


  // Check if tweet contains foul language
  let cleanTweet = true;
  const textArray = text.toLowerCase().split(' ');
  for (let i = 0; i < textArray.length; i++) {
    if (badwordsArray.indexOf(textArray[i]) !== -1) {
      cleanTweet = false;
      break;
    }
  }

  // Check if @yegbot tagged in tweet
  let directedAt = false;
  for (let i = 0; i < replyTo.length; i++) {
    const screenName = replyTo[i].screen_name.toLowerCase();
    if (screenName === 'yegbot') {
      directedAt = true;
      break;
    }
  }

  // Check if someone retweeted YegBots own tweet
  // Might need to add later

  // If both clean, user not blocked & directed at yegbot, retweet it. Else, say no
  if (cleanTweet && directedAt && from !== 'yegbot' && checkIfMuted(blockedIDs, userID)) {
    console.log("tweeted");
    T.post('statuses/retweet/:id', { id: tweetID }, function (err, data, response) {
      console.log(`Retweeted tagged tweet from ${from} with id of: ${tweetID}`);
    })
  } else {
  console.log(`Tweet from ${from} contained foul language, not directed at yegbot, and/or muted, not retweeting`);
  }
}


function getMutedList() {
  console.log("Getting list");
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
