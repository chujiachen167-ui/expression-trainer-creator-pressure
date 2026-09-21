(() => {
  const STATES = ['listen', 'confused', 'interest', 'drop'];

  function expressionFromEvent(event) {
    if (!event || event.confidence === 'insufficient') return 'listen';
    const delta = Number(event.scoreDelta);
    const shift = Number.isFinite(delta) ? delta : 0;
    if (shift >= 4) return 'interest';
    if (event.type === 'search-support') return 'interest';
    if (event.type === 'relevance' || shift <= -8) return 'drop';
    if (shift < 0) return 'confused';
    if (event.type === 'opening' && shift === 0) return 'listen';
    return 'listen';
  }

  function label(state, locale = 'zh-CN') {
    const zh = { listen: '在听', confused: '没跟上', interest: '兴趣回升', drop: '注意力下降' };
    const en = { listen: 'Listening', confused: 'Lost', interest: 'Interest up', drop: 'Attention dropping' };
    const table = locale === 'en-US' ? en : zh;
    return table[state] || table.listen;
  }

  window.CreatorAudienceExpression = { STATES, expressionFromEvent, label };
})();
