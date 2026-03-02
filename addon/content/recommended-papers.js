// Recommended Papers Window Logic

// 全局函数
function displayRecommendedPapers() {
  const papersContainer = document.getElementById('papers-container');
  const papers = window.recommendedPapers || [];

  if (papers.length === 0) {
    papersContainer.innerHTML = '<xul:label value="No recommended papers found." style="padding: 20px; text-align: center; color: #666;"></xul:label>';
    return;
  }

  // 清空容器
  papersContainer.innerHTML = '';

  // 添加每篇文献
  papers.forEach((paper, index) => {
    const paperItem = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'vbox');
    paperItem.className = 'paper-item';

    // 标题
    const titleLabel = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'label');
    titleLabel.className = 'paper-title';
    titleLabel.setAttribute('value', `${index + 1}. ${paper.title}`);
    paperItem.appendChild(titleLabel);

    // 作者
    const authorsLabel = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'label');
    authorsLabel.className = 'paper-authors';
    authorsLabel.setAttribute('value', `Authors: ${paper.authors ? paper.authors.join(', ') : 'Unknown'}`);
    paperItem.appendChild(authorsLabel);

    // 期刊/来源
    const journalLabel = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'label');
    journalLabel.className = 'paper-journal';
    journalLabel.setAttribute('value', `Source: ${paper.journal || paper.published ? new Date(paper.published).toLocaleDateString() : 'arXiv'}`);
    paperItem.appendChild(journalLabel);

    // 链接
    const url = paper.pdf_url || paper.url;
    if (url) {
      const linkLabel = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'label');
      linkLabel.className = 'paper-link';
      linkLabel.setAttribute('value', `Link: ${url}`);
      linkLabel.setAttribute('style', 'color: blue; text-decoration: underline; cursor: pointer;');
      linkLabel.setAttribute('onclick', `window.open('${url}', '_blank')`);
      paperItem.appendChild(linkLabel);
    }

    // 操作按钮
    const actionsBox = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'hbox');
    actionsBox.className = 'paper-actions';

    // 添加到Zotero按钮
    const addButton = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'button');
    addButton.setAttribute('label', 'Add to Zotero');
    addButton.setAttribute('oncommand', `addToZotero(${JSON.stringify(paper).replace(/'/g, "\\'")})`);
    actionsBox.appendChild(addButton);

    paperItem.appendChild(actionsBox);
    papersContainer.appendChild(paperItem);
  });
}

function addToZotero(paper) {
  try {
    // 获取Zotero对象
    const Zotero = window.opener.Zotero;
    if (!Zotero) {
      throw new Error('Zotero object not found');
    }

    // 调用Zotero的API添加文献
    const item = new Zotero.Item('journalArticle');
    item.setField('title', paper.title);

    // 设置作者
    if (paper.authors && paper.authors.length > 0) {
      const creators = paper.authors.map(author => {
        const parts = author.split(' ');
        const lastName = parts.pop();
        const firstName = parts.join(' ');
        return {
          creatorType: 'author',
          firstName: firstName,
          lastName: lastName
        };
      });
      item.setCreators(creators);
    }

    // 设置摘要（如果存在）
    if (paper.summary) {
      item.setField('abstractNote', paper.summary);
    }

    // 设置URL（如果存在）
    if (paper.pdf_url || paper.url) {
      item.setField('url', paper.pdf_url || paper.url);
    }

    // 设置DOI（如果存在）
    if (paper.doi) {
      item.setField('DOI', paper.doi);
    }

    // 设置日期（如果存在）
    if (paper.published) {
      item.setField('date', new Date(paper.published).toISOString().split('T')[0]);
    }

    // 设置期刊/来源
    item.setField('publicationTitle', paper.journal || 'arXiv');

    item.saveTx();

    // 显示成功通知
    alert('Paper added to Zotero successfully!');
  } catch (error) {
    console.error('Error adding paper to Zotero:', error);
    alert('Failed to add paper to Zotero. ' + error.message);
  }
}

// 页面加载时执行
window.addEventListener('load', function () {
  // 显示推荐文献
  displayRecommendedPapers();
});

// 将函数暴露为全局函数
window.displayRecommendedPapers = displayRecommendedPapers;
window.openPaper = openPaper;
window.addToZotero = addToZotero;
