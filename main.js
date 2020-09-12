const async = require("async");
const fs = require("await-fs");
const path = require("path");
const eBookScraper = require("./ebook.scraper");
const mkdir = require("make-dir");
const download = require("download");
const PromisePool = require('@supercharge/promise-pool');

const Progress = require('progress');
const MultiProgress = require('multi-progress')(Progress);

const DOWNLOAD_DIR = "allite";


class Page {
	async procPage(detailUrl) {
				// parse the detail page
				// console.log("DETAIL:", detailUrl);

				// check if we already downloaded this ebook by checking if a coherent folder exists
				const eBookNameSlug = detailUrl
				.replace("http://www.allitebooks.org", "")
				.replace("/", "");

				const eBookFolderPath = DOWNLOAD_DIR + "/" + eBookNameSlug;

				var alreadyDownloaded = false;
				try {
					alreadyDownloaded = await fs.stat(eBookFolderPath);
				} catch (e) {
					alreadyDownloaded = false;
					await mkdir(eBookFolderPath);
				}

				if (alreadyDownloaded) {
					// console.log("→ skipped");
					return;
				}

				try {
					// parse the detail page
					await scraper.load(detailUrl);
					const ebook = await scraper.parseDetailPage();

					// download description text
					fs.writeFile(eBookFolderPath + "/description.txt", ebook.description);

					// download ebook pdfs or zips
					// for (const file of ebook.files) {
					// async.map( ebook.files, (file) => {
					// let data = null;

					const { results, errors } = await PromisePool
						.for(ebook.files)
						.withConcurrency(20)
						.process( async file => {

							const bar = multi.newBar("[:bar] :percent :etas", {
								complete: "=",
								incomplete: " ",
								width: 40,
								total: 0
							});

							const data = await download(file.url)
							.on("response", (res) => {
								bar.total = res.headers["content-length"];
								res.on("data", (data) => bar.tick(data.length));
							});

							fs.writeFile(eBookFolderPath + "/" + file.name, data);
						});

					} catch (e) {
					console.log(e);
				}
	}
}


// init scraper
const scraper = new eBookScraper();
var pageUrl = scraper.overviewUrl;
const multi = new MultiProgress(process.stderr);
const page = new Page();


(async () => {
	console.log("PAGE:", pageUrl);
	// parse a single overview page until no new page is available
	do {
		// console.log("PAGE:", pageUrl);

		// load the overview page to scrape from
		await scraper.load(pageUrl);

		// parse all detail pages of this overview page
		const detailUrls = scraper.parseDetailPages();

		// parse the next page url
		pageUrl = scraper.parseNextPage();

		// async loop over etail urls and download them


		const { results, errors } = await PromisePool
			.for(detailUrls)
			.withConcurrency(4)
			.process( async detailUrl => {
				page.procPage( detailUrl );
			});
	} while (pageUrl !== null);
})();
