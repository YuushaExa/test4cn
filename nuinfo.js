/* ---------- helpers ---------- */
const nuBtn = document.getElementById('nuInfoBtn');
const autoFillBtn = document.getElementById('autoFillBtn');
const nuInfo = document.getElementById('nuInfo');
const nuInfoResults = document.getElementById('nuInfoResults');

function closeNuInfo() {
  nuInfo.style.display = 'none';
  nuInfoResults.innerHTML = '';
}

/* ---------- fetch search page and display results ---------- */
async function openNuSearch() {
  const query = novelData.metadata?.title?.trim()
             || prompt('Enter novel title for NovelUpdates search:')?.trim();
  if (!query) return;

  const searchUrl = `https://www.novelupdates.com/series-finder/?sf=1&sh=${encodeURIComponent(query)}&sort=sdate&order=desc`;

  try {
    nuBtn.disabled = true;
    log(`Fetching NU search for "${query}" …`);
    const html = await fetchRawHTML(searchUrl);

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const series = doc.querySelectorAll('.search_main_box_nu');
    if (!series.length) {
      log('No results found on NovelUpdates.');
      return;
    }

    let resultsHtml = '';
    series.forEach(box => {
      const titleLink = box.querySelector('.search_title a');
      const infoButton = `<button class="info-btn" data-url="${titleLink.href}">Info</button>`;
      resultsHtml += box.outerHTML + infoButton + '<hr>';
    });

    nuInfoResults.innerHTML = resultsHtml;
    nuInfo.style.display = 'block';

    // Add click event to each Info button
    document.querySelectorAll('.info-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const url = button.getAttribute('data-url');
        try {
          const detailedHtml = await fetchRawHTML(url);
          const detailedDoc = new DOMParser().parseFromString(detailedHtml, 'text/html');

          const title = detailedDoc.querySelector('.seriestitlenu')?.textContent || 'Title not found';
          const imageUrl = detailedDoc.querySelector('.seriesimg img')?.src || 'Image not found';
          const type = detailedDoc.querySelector('#showtype a')?.textContent || 'Type not found';
          const genres = Array.from(detailedDoc.querySelectorAll('#seriesgenre a')).map(a => a.textContent).join(', ') || 'Genres not found';
    const authors = Array.from(detailedDoc.querySelectorAll('#showauthors a')).map(a => a.textContent).join(', ') || 'Authors not found';
    const authorUrls = Array.from(detailedDoc.querySelectorAll('#showauthors a')).map(a => a.href).join(', ') || 'Authors URL not found';
          const year = detailedDoc.querySelector('#edityear')?.textContent || 'Year not found';
          const statuscoo = detailedDoc.querySelector('#editstatus')?.textContent || 'Status not found';
          const originalPublisher = detailedDoc.querySelector('#showopublisher a')?.textContent || 'Original Publisher not found';
          const englishPublisher = detailedDoc.querySelector('#showepublisher span')?.textContent || 'English Publisher not found';
          const description = detailedDoc.querySelector('#editdescription p')?.textContent || 'Description not found';
const associatedNames = detailedDoc.querySelector('#editassociated')?.innerHTML || 'Associated Names not found';

          const relatedSeries = Array.from(detailedDoc.querySelectorAll('h5.seriesother + div a')).map(a => `<a class="genre" href="${a.href}">${a.textContent}</a>`).join('<br>') || 'Related Series not found';
          const recommendations = Array.from(detailedDoc.querySelectorAll('h5.seriesother + div a')).map(a => `<a class="genre" href="${a.href}">${a.textContent}</a>`).join('<br>') || 'Recommendations not found';
          const language = detailedDoc.querySelector('#showlang a')?.textContent || 'Language not found';

          const formattedAssociatedNames = associatedNames.split(/<br\s*\/?>/gi).join(', ');

          // Format associated names by new line
          const detailedContent = `
            <div class="seriestitlenu" style="font-size:18px; margin-top: 10px; color: #292e33;">${title}</div>
            <div class="seriesimg">
              <img src="${imageUrl}">
            </div>
            <h5 class="seriesother">Type</h5>
            <span class="typelmsg"></span>
            <div id="showtype">
              <a class="genre type" href="#">${type}</a> <span style="color:#8D8D8D;">(CN)</span><br>
            </div>
            <h5 class="seriesother">Genre</h5>
            <span class="genremsg"></span>
<div id="seriesgenre">
  ${genres.split(', ').map(genre => `<a class="genre" href="#">${genre}</a>`).join(', ')}
</div>
     <h5 class="seriesother">Author(s)</h5>
      <div id="showauthors">
        ${authors.split(', ').map((author, index) => `<a class="genre" href="${authorUrls.split(', ')[index]}">${author}</a>`).join(', ')}
      </div>
            <h5 class="seriesother">Year</h5>
            <div id="edityear">${year}</div>
            <h5 class="seriesother" title="Status in Country of Origin">Status in COO</h5>
            <div id="editstatus">${statuscoo}</div>
            <h5 class="seriesother">Original Publisher</h5>
            <div id="showopublisher">
              <a class="genre" href="#">${originalPublisher}</a>
            </div>
            <h5 class="seriesother">English Publisher</h5>
            <div id="showepublisher">
              ${englishPublisher}
            </div>
            <h5 class="seriesother">Language</h5>
            <div id="showlang">
              <a class="genre lang" href="#">${language}</a>
            </div>
            <h5 class="seriesother">Associated Names</h5>
            <div id="editassociated">${formattedAssociatedNames}</div>
            <h5 class="descripti">Description</h5>
            <div id="editdescription">${description}</div>
          `;

          // Get first author URL
const firstAuthorUrl = detailedDoc.querySelector('#showauthors a')?.href;

let authorWorksHtml = '';
if (firstAuthorUrl) {
  authorWorksHtml = await fetchAuthorWorks(firstAuthorUrl);
}

// Append author works to detailed content
nuInfoResults.innerHTML = detailedContent + authorWorksHtml;

          autoFillBtn.disabled = false;
          showEditMetadataForm();
          autoFillBtn.click();
          const submitButton = document.querySelector('#metadataForm button[type="submit"]');
          if (submitButton) {
            submitButton.click();
          }
        } catch (e) {
          log(`Error fetching detailed info: ${e.message}`);
        }
      });
    });
  } catch (e) {
    log(`NU search error: ${e.message}`);
  } finally {
    nuBtn.disabled = false;
  }
}

// ---------- Fetch Author Works (only image, title, genres, description) ----------
async function fetchAuthorWorks(authorUrl) {
  try {
    log(`Fetching author works from: ${authorUrl}`);
    const authorHtml = await fetchRawHTML(authorUrl);
    const authorDoc = new DOMParser().parseFromString(authorHtml, 'text/html');
    const works = authorDoc.querySelectorAll('.search_main_box_nu');

    if (!works.length) {
      log('No works found for this author.');
      return '<p>No other works found for this author.</p>';
    }

    let worksHtml = '';
    works.forEach(work => {
      const img = work.querySelector('img')?.src || '';
      const titleEl = work.querySelector('.search_title a');
      const title = titleEl?.textContent?.trim() || 'No Title';
      const titleHref = titleEl?.href || '#';

      // genres
      const genres = Array.from(work.querySelectorAll('.search_genre a'))
        .map(a => `<a class="genre" href="${a.href}">${a.textContent}</a>`)
        .join(', ') || 'No genres';

      // get full description
      let descNode = work.querySelector('.testhide') || work.querySelector('.search_body_nu');
      let description = descNode ? descNode.innerHTML : 'No description available';

      // remove "less" links and onclick junk
      description = description.replace(/<span[^>]*class="morelink[^>]*>.*?<\/span>/gi, '');
      description = description.replace(/<span[^>]*class="less[^>]*>.*?<\/span>/gi, '');
      description = description.replace(/onclick="[^"]*"/gi, '');

      // decode HTML entities and strip any leftover tags
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = description;
      description = tempDiv.textContent.trim();

      worksHtml += `
        <div class="search_main_box_nu" style="margin-bottom:20px;">
          <div class="seriesimg"><img src="${img}" alt="${title}" style="max-width:120px;"></div>
          <div class="seriestitlenu" style="font-size:16px; font-weight:bold; margin-top:5px;">
            <a href="${titleHref}" target="_blank">${title}</a>
          </div>
          <div class="seriesgenre" style="margin-top:5px;">${genres}</div>
          <div class="seriesdesc" style="margin-top:5px;">${description}</div>
        </div>
      `;
    });

    return `
      <div id="AuthorWorks" style="margin-top:10px;">
        <h5 class="seriesother">Other Works by Author</h5>
        ${worksHtml}
      </div>
    `;
  } catch (e) {
    log(`Error fetching author works: ${e.message}`);
    return '<p>Error fetching author works.</p>';
  }
}




/* ---------- AutoFill button click event ---------- */
autoFillBtn.addEventListener('click', () => {
  const coverUrl = nuInfoResults.querySelector('.seriesimg img')?.src || '';
  const altTitle = nuInfoResults.querySelector('#editassociated')?.textContent || '';
  const date = nuInfoResults.querySelector('#edityear')?.textContent || '';
  const statuscoo = nuInfoResults.querySelector('#editstatus')?.textContent || '';
  const language = nuInfoResults.querySelector('#showlang a')?.textContent || '';
  const originalPublisher = nuInfoResults.querySelector('#showopublisher a')?.textContent || '';

  const editCover = document.getElementById('editCover');
  const editAltTitle = document.getElementById('editaltitile');
  const editDate = document.getElementById('editdate');
  const editstatuscoo = document.getElementById('editstatuscoo');
  const editlanguage = document.getElementById('editlanguage');
  const editoriginalPublisher = document.getElementById('editoriginalPublisher');

  if (editCover) editCover.value = coverUrl;
  if (editAltTitle) editAltTitle.value = altTitle;
  if (editDate) editDate.value = date;
  if (editstatuscoo) editstatuscoo.value = statuscoo;
  if (editlanguage) editlanguage.value = language;
  if (editoriginalPublisher) editoriginalPublisher.value = originalPublisher;
});
/* ---------- enable/disable button ---------- */
fetchMetadataBtn.addEventListener('click', () => {
  const chk = setInterval(() => {
    if (novelData.metadata?.title) {
      nuBtn.disabled = false;
      clearInterval(chk);
    }
  }, 500);
});
nuBtn.addEventListener('click', openNuSearch);
