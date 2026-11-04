# TJify

[한국어](./README.md) · **English**

A website that finds songs to sing from your own Spotify and YouTube music, so you don't end up singing the same song at karaoke every time. The site is available in Korean and English.

> Search tool to search your Spotify / YouTube music so you don't need to sing the same song over and over.

Paste a playlist you already listen to, and for each song it shows:

- **TJ and KY (Kumyoung) karaoke numbers**: uncertain numbers get a `?`, and you can tap a song to pick another candidate or search yourself
- **Difficulty**: five levels from very easy to very hard, with reasons (high notes, rap, fast tempo and so on). An AI estimates it, and your own rating comes first if you set one
- **Sing-along potential**: whether the people you're with will know it, shown as "Sing-along / Widely known / Fairly known / Fans only"
- **What should I sing?**: picks a song you haven't sung in the last 2 weeks. With "Only sing-along songs" on, it picks from those
- **Singing history**, and sorting by easiest, hardest or most popular

TJ and KY are the two karaoke machine brands found in most Korean karaoke rooms (noraebang). Their song lists use the titles shown on the machines, so Korean songs are usually listed by their Korean titles.

## How to use it

1. Paste a playlist link into **Import a link** and press "Import".
2. Numbers and difficulty fill in song by song. Results stay in your browser, so they show up instantly next time.
3. Tap a song to see candidate numbers, difficulty and popularity, and mark it with "I sang this".

No link? Paste "Artist - Title" one per line in the **Paste a list** tab. A Spotify CSV exported with Exportify works too. Use the **한국어** button at the top to switch to Korean.

## Supported links

| Link | Without signing in | Notes |
| --- | --- | --- |
| YouTube / YouTube Music playlist (contains `list=`) | Yes (when a YouTube API key is set) | Public or unlisted playlists only. Auto-generated mixes don't work |
| Spotify playlist | No | Only playlists created by, or shared for collaboration with, the connected account |

Since Spotify's February 2026 policy change, apps in development mode can't read other people's playlists (even public ones) or playlists made by Spotify. There's no way around this with the official API, so pasting the song list is the quickest option for a friend's playlist.

After importing, the page address becomes `/?import=<playlist link>`. For YouTube playlists, you can send that address to a friend to open the same list.

## How numbers, difficulty and popularity are decided

- **Numbers**: both TJ and KY numbers come from Manana, a public karaoke API used by many karaoke number apps. Spacing, brackets and version tags (`feat.`, `Live` and so on) are ignored, and English and Korean artist names (like "IU" and "아이유") are treated as the same.
- **Difficulty**: there's no public data on karaoke difficulty, so an AI estimates it for someone without vocal training singing at karaoke. Songs it doesn't know are left blank instead of guessed.
  - The default is the **free tier of the Google Gemini API**. If the site has a free key, every visitor can use it. You can also create your own free key in [Google AI Studio](https://aistudio.google.com/apikey) (no card needed) and add it in settings.
  - If you add your own Anthropic API key (paid) in settings, Claude estimates instead.
- **Sing-along potential**: the highest of these signals wins.
  - In the TJ karaoke TOP 100 chart in the past year → "Sing-along" (the chart is fetched when the site is built, and refreshed weekly)
  - YouTube views (for songs imported from YouTube): 100M+ "Sing-along", 20M+ "Widely known", 3M+ "Fairly known"
  - The AI's popularity estimate (5 levels)
- Numbers can differ by machine model and update date, and difficulty and popularity are estimates.

## Privacy

- This site has no server. Karaoke lookups and YouTube, Spotify and AI requests go straight from your browser to those services.
- Connecting an account asks for read access only. Sign-in tokens, API keys you add in settings, found numbers, numbers you picked, your ratings and your singing history are stored only in your browser.
- Only song titles and artists are sent to the AI. On Gemini's free tier, what you send may be used to improve Google's products.

## Hosting the site (GitHub Pages)

It's a static site made of HTML and JavaScript files with no server, so GitHub Pages can host it for free. After a one-time setup, the site rebuilds automatically whenever code lands on the main branch.

1. In the repository, go to **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
2. Push the code to main. If it's already there, run **Actions → GitHub Pages → Run workflow**.
3. After a minute or two, the site opens at https://psp3322.github.io/TJify/.

All keys are optional. Pasting lists and finding numbers work with no keys at all, and visitors can add their own keys in **Settings** at the bottom of the page. To turn features on for every visitor, add these under **Settings → Secrets and variables → Actions → Variables** and run the workflow again.

| Variable | Turns on |
| --- | --- |
| `GEMINI_API_KEY` | Automatic difficulty and popularity estimates (Gemini free tier) |
| `YOUTUBE_API_KEY` | Importing YouTube playlist links, view counts |
| `SPOTIFY_CLIENT_ID` | Connecting Spotify (Liked Songs, your playlists) |
| `GOOGLE_CLIENT_ID` | Connecting YouTube (liked videos, your playlists) |

These values end up in the site's JavaScript, so they're public.

- Create the Gemini key in a **free-tier project with billing turned off**, and restrict it to the Gemini API and this site's address. That way nobody can run up a bill with it; at worst, the day's free quota runs out early. Google recommends against putting keys in web pages, so treat this as a trade-off for a free hobby site.
- Restrict the YouTube API key to the YouTube Data API and this site's address as well.
- Anthropic API keys are paid, so the site never includes one. People who want Claude add their own key in settings.

How to create keys, run the site locally or host it elsewhere is covered in [docs/SETUP.md](./docs/SETUP.md) (Korean).

## Credits and disclaimer

- The TJ chart request flow is based on [karaoke_singer](https://github.com/betty2859/karaoke_singer).
- TJ and KY numbers come from the [Manana karaoke API](https://api.manana.kr/karaoke).
- A personal project, not affiliated with TJ Media or Kumyoung Entertainment.

License: [Apache-2.0](./LICENSE)
