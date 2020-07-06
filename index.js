require("dotenv").config();
const { WakaTimeClient, RANGE } = require("wakatime-client");
const Octokit = require("@octokit/rest");

const {
  GIST_ID: gistId,
  GH_TOKEN: githubToken,
  WAKATIME_API_KEY: wakatimeApiKey
} = process.env;

const wakatime = new WakaTimeClient(wakatimeApiKey);

const octokit = new Octokit({ auth: `token ${githubToken}` });

async function main() {
  const stats = await wakatime.getMyStats({ range: RANGE.LAST_7_DAYS });
  await updateGist(stats);
}

async function updateGist(stats) {
  let gist;
  try {
    gist = await octokit.gists.get({ gist_id: gistId });
  } catch (error) {
    console.error(`Unable to get gist\n${error}`);
  }

  const lines = [];

  const { percent, currentYear } = getDateInfo(new Date());

  lines.push(["🕓", generateBarChart(percent, 22), currentYear + 1].join(" "));

  lines.push("");

  for (let i = 0; i < Math.min(stats.data.languages.length, 3); i++) {
    const data = stats.data.languages[i];
    const { name, percent, text: time } = data;

    const line = [
      name.padEnd(11),
      time
        .replace(/hrs?/g, "h")
        .replace(/mins?/g, "m")
        .padEnd(9),
      generateBarChart(percent, 21),
      String(percent.toFixed(1)).padStart(5) + "%"
    ];

    lines.push(line.join(" "));
  }

  try {
    // Get original filename to update that same file
    const filename = Object.keys(gist.data.files)[0];
    await octokit.gists.update({
      gist_id: gistId,
      files: {
        [filename]: {
          filename: `📊 Weekly development breakdown`,
          content: lines.join("\n")
        }
      }
    });
  } catch (error) {
    console.error(`Unable to update gist\n${error}`);
  }
}

function getDateInfo(date) {
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth();

  let percent = "";
  let totalDay = 0;
  let passDay = 0;

  for (let i = 0; i < 12; i++) {
    totalDay += new Date(currentYear, i + 1, 0).getDate();
    if (i < currentMonth) {
      passDay += new Date(currentYear, i + 1, 0).getDate();
    } else if (i === currentMonth) {
      passDay += new Date(date).getDate();
    }
  }

  passDay--;

  percent = ((passDay / totalDay) * 100).toFixed(2);

  return { passDay, totalDay, percent, currentYear };
}

function generateBarChart(percent, size) {
  const syms = "░▏▎▍▌▋▊▉█";

  const frac = Math.floor((size * 8 * percent) / 100);
  const barsFull = Math.floor(frac / 8);
  if (barsFull >= size) {
    return syms.substring(8, 9).repeat(size);
  }
  const semi = frac % 8;

  return [syms.substring(8, 9).repeat(barsFull), syms.substring(semi, semi + 1)]
    .join("")
    .padEnd(size, syms.substring(0, 1));
}

(async () => {
  await main();
})();
