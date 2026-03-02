// Recommended Papers Window Logic

window.addEventListener('load', function() {
  // 显示推荐文献
  displayRecommendedPapers();
});

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
    
    // 操作按钮
    const actionsBox = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'hbox');
    actionsBox.className = 'paper-actions';
    
    // 打开链接按钮
    const openButton = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'button');
    openButton.setAttribute('label', 'Open');
    openButton.setAttribute('oncommand', `openPaper('${paper.pdf_url || paper.url}')`);
    actionsBox.appendChild(openButton);
    
    // 添加到Zotero按钮
    const addButton = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'button');
    addButton.setAttribute('label', 'Add to Zotero');
    addButton.setAttribute('oncommand', `addToZotero(${JSON.stringify(paper).replace(/'/g, "\\'")})`);
    actionsBox.appendChild(addButton);
    
    paperItem.appendChild(actionsBox);
    papersContainer.appendChild(paperItem);
  });
}

function openPaper(url) {
  if (url) {
    window.open(url, '_blank');
  }
}

function addToZotero(paper) {
  try {
    // 调用Zotero的API添加文献
    const item = new Zotero.Item('journalArticle');
    item.setField('title', paper.title);
    item.setField('creators', paper.authors ? paper.authors.map(author => ({
      creatorType: 'author',
      firstName: author.split(' ').slice(0, -1).join(' '),
      lastName: author.split(' ').pop()
    })) : []);
    item.setField('abstractNote', paper.summary);
    item.setField('url', paper.pdf_url || paper.url);
    item.setField('DOI', paper.doi);
    item.setField('date', paper.published ? new Date(paper.published).toISOString().split('T')[0] : '');
    item.setField('publicationTitle', paper.journal || 'arXiv');
    
    item.saveTx();
    
    // 显示成功通知
    const notification = new ztoolkit.ProgressWindow('Literature Tracker', {
      closeOnClick: true,
      closeTime: -1,
    });
    notification.createLine({
      text: 'Paper added to Zotero successfully!',
      type: 'default',
      progress: 100,
    });
    notification.show().startCloseTimer(3000);
  } catch (error) {
    console.error('Error adding paper to Zotero:', error);
    
    // 显示错误通知
    const notification = new ztoolkit.ProgressWindow('Literature Tracker', {
      closeOnClick: true,
      closeTime: -1,
    });
    notification.createLine({
      text: 'Failed to add paper to Zotero.',
      type: 'error',
      progress: 100,
    });
    notification.show().startCloseTimer(3000);
  }
}
