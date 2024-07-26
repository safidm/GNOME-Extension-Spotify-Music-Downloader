const { google } = require('googleapis');
const youtube = google.youtube('v3');

const API_KEY = 'API KEY';


async function searchYouTube(query) {
    const response = await youtube.search.list({
        key: API_KEY,
        part: 'snippet',
        q: query,
        maxResults: 1,
    });

    if (response.data.items.length > 0) {
        const videoId = response.data.items[0].id.videoId;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        console.log(videoUrl);
        process.exit()
    } else {
        console.log('No results found');
        process.exit()
    }
}

const query = process.argv.slice(2).join(' ');

searchYouTube(query).catch(console.error);


