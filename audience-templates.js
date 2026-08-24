(() => {
  const profiles = {
    fastScroller: {
      id: 'fastScroller', glyph: '划', name: '快划观众', role: '三秒判断是否值得继续看',
      motivation: '尽快获得明确价值', priorities: ['opening', 'density', 'relevance']
    },
    beginner: {
      id: 'beginner', glyph: '新', name: '零基础观众', role: '需要把专业内容听明白',
      motivation: '听懂并能复述核心结论', priorities: ['jargon', 'example', 'structure']
    },
    practicalBuyer: {
      id: 'practicalBuyer', glyph: '买', name: '实用型买家', role: '只关心是否适合自己',
      motivation: '判断使用场景、代价与收益', priorities: ['relevance', 'evidence', 'adTrust']
    },
    comparisonBuyer: {
      id: 'comparisonBuyer', glyph: '比', name: '对比型买家', role: '正在比较多个选择',
      motivation: '获得明确差异和选择依据', priorities: ['evidence', 'specificity', 'tradeoff']
    },
    loyalFollower: {
      id: 'loyalFollower', glyph: '粉', name: '长期关注者', role: '熟悉创作者原本的表达',
      motivation: '确认内容真实且保持个人风格', priorities: ['adTrust', 'example', 'authenticity']
    },
    skeptic: {
      id: 'skeptic', glyph: '疑', name: '怀疑型观众', role: '会验证主张是否站得住',
      motivation: '看到证据、边界和反例', priorities: ['evidence', 'specificity', 'tradeoff']
    },
    cautiousParent: {
      id: 'cautiousParent', glyph: '慎', name: '谨慎决策者', role: '对风险和副作用敏感',
      motivation: '先排除风险再考虑行动', priorities: ['tradeoff', 'evidence', 'specificity']
    },
    informedViewer: {
      id: 'informedViewer', glyph: '专', name: '懂行观众', role: '能识别概念和事实错误',
      motivation: '获得准确且不偷换概念的解释', priorities: ['jargon', 'evidence', 'structure']
    }
  };

  const templates = [
    { id: 'knowledge-beginner', name: '知识科普 · 零基础受众', domain: '知识科普', platform: 'B站 / 视频号', goal: '让陌生概念被听懂并愿意关注', scenario: '知识口播', prompt: '请把一个专业知识点讲给完全不了解它的观众：先说它解决什么问题，再用一个生活例子解释。', audiences: ['beginner', 'fastScroller', 'informedViewer'] },
    { id: 'tech-comparison', name: '科技测评 · 对比购买者', domain: '科技数码', platform: 'B站 / 抖音', goal: '帮助观众做购买判断', scenario: '产品测评', prompt: '请介绍一款产品值不值得买：先给结论，再说适合谁、不适合谁以及一个关键差异。', audiences: ['comparisonBuyer', 'practicalBuyer', 'skeptic'] },
    { id: 'beauty-conversion', name: '美妆种草 · 理性消费者', domain: '美妆个护', platform: '小红书 / 抖音', goal: '建立信任后产生购买兴趣', scenario: '自然种草', prompt: '请自然介绍一款产品：先讲真实使用问题，再说明效果边界和适合人群。', audiences: ['practicalBuyer', 'loyalFollower', 'skeptic'] },
    { id: 'finance-novice', name: '财经解释 · 风险敏感新手', domain: '财经知识', platform: '视频号 / B站', goal: '解释机会同时说清风险', scenario: '观点口播', prompt: '请向普通人解释一个财经观点：先给结论，再说明依据、适用条件和主要风险。', audiences: ['beginner', 'cautiousParent', 'informedViewer'] },
    { id: 'fitness-beginner', name: '健身教学 · 结果型新手', domain: '健身健康', platform: '抖音 / 小红书', goal: '让新手愿意尝试一个动作', scenario: '步骤教学', prompt: '请教新手完成一个健身动作：先说收益，再讲三个步骤和一个常见风险。', audiences: ['fastScroller', 'beginner', 'cautiousParent'] },
    { id: 'lifestyle-follow', name: '生活方式 · 潜在关注者', domain: '生活方式', platform: '小红书 / 抖音', goal: '建立真实感并促进关注', scenario: '经验分享', prompt: '请分享一个真实生活经验：开头直接说变化，再讲一个具体细节和可复制的方法。', audiences: ['fastScroller', 'loyalFollower', 'skeptic'] },
    { id: 'parenting-decision', name: '母婴育儿 · 谨慎家长', domain: '母婴育儿', platform: '小红书 / 视频号', goal: '给出可信且有边界的建议', scenario: '经验解释', prompt: '请解释一个育儿选择：先说明适用情况，再讲依据、风险和不能替别人决定的部分。', audiences: ['cautiousParent', 'skeptic', 'beginner'] },
    { id: 'personal-ip', name: '个人 IP · 新老观众混合', domain: '个人成长', platform: '全平台', goal: '说明账号价值并建立持续关注', scenario: '账号开场', prompt: '请用 60 秒说明你的账号持续为谁提供什么价值，并用一个真实例子证明。', audiences: ['fastScroller', 'loyalFollower', 'skeptic'] }
  ];

  const vagueWords = ['很多', '比较', '可能', '感觉', '东西', '方面', '有点', '某种'];
  const jargonWords = ['赋能', '闭环', '抓手', '底层逻辑', '赛道', '方法论', '颗粒度'];
  const conclusionWords = ['结论', '核心', '关键', '答案', '直接说', '最重要', '值得', '不值得'];
  const exampleWords = ['比如', '例如', '我曾经', '实际', '具体来说', '一次'];
  const evidenceWords = ['数据', '测试', '对比', '研究', '因为', '结果', '证明'];
  const tradeoffWords = ['但是', '代价', '风险', '不适合', '限制', '前提', '边界'];

  function countTerms(text, terms) {
    return terms.reduce((sum, term) => sum + (text.split(term).length - 1), 0);
  }

  function observe(text, elapsedSeconds) {
    const normalized = (text || '').replace(/\s/g, '');
    const vague = vagueWords.filter(word => normalized.includes(word));
    const jargon = jargonWords.filter(word => normalized.includes(word));
    return {
      text: normalized,
      elapsedSeconds,
      wordCount: normalized.length,
      opening: elapsedSeconds > 8 && !conclusionWords.some(word => normalized.includes(word)),
      density: elapsedSeconds > 12 && normalized.length < elapsedSeconds * 2.2,
      specificity: vague.length > 0,
      vague,
      jargon,
      example: normalized.length > 35 && !exampleWords.some(word => normalized.includes(word)),
      evidence: normalized.length > 45 && !/\d/.test(normalized) && !evidenceWords.some(word => normalized.includes(word)),
      tradeoff: normalized.length > 55 && !tradeoffWords.some(word => normalized.includes(word)),
      relevance: elapsedSeconds > 15 && !['适合', '你', '观众', '用户', '人群'].some(word => normalized.includes(word)),
      adTrust: ['推荐', '购买', '产品', '品牌'].some(word => normalized.includes(word)) && !['真实', '体验', '限制', '不适合'].some(word => normalized.includes(word)),
      structure: normalized.length > 60 && !['第一', '第二', '首先', '其次', '最后'].some(word => normalized.includes(word))
    };
  }

  const reactions = {
    opening: ({ template }) => `我还没听到结论。对“${template.goal}”来说，第一句话能不能直接说价值？`,
    density: () => '我等了一会儿，信息还没有往前走。请删掉铺垫，直接进入下一条有效信息。',
    specificity: ({ observation }) => `你刚才说“${observation.vague[0]}”，这个词太宽了。请换成数量、条件或一个可验证的结果。`,
    jargon: ({ observation }) => `“${observation.jargon[0]}”对我来说仍然抽象。能不能换成一个普通人看得见的动作或结果？`,
    example: () => '道理我听到了，但还没有画面。请给一个你亲自经历或能具体复述的例子。',
    evidence: () => '这个结论凭什么成立？请补充数据、测试过程或可核对的事实。',
    tradeoff: () => '你只讲了好处。它不适合谁，代价或限制是什么？',
    relevance: ({ profile }) => `我是${profile.name}，这件事和我有什么直接关系？请明确说出适用人群。`,
    adTrust: () => '这里开始像广告话术了。先讲你的真实体验和不适用情况，我才会继续相信。',
    structure: () => '信息有点散。请暂停一下，用“结论、理由、例子”三步重新组织。',
    continue: ({ profile, template }) => `我代表${profile.name}。继续，但下一句请围绕“${template.goal}”给我一个新的有效信息。`
  };

  function nextReaction({ template, profile, observation, pressure = 'medium', eventIndex = 0 }) {
    const isTriggered = key => Array.isArray(observation[key]) ? observation[key].length > 0 : Boolean(observation[key]);
    const active = profile.priorities.filter(isTriggered);
    const fallback = Object.keys(reactions).filter(key => key !== 'continue' && isTriggered(key));
    const candidates = active.length ? active : fallback;
    const signal = candidates[eventIndex % Math.max(candidates.length, 1)] || 'continue';
    const text = reactions[signal]({ template, profile, observation });
    const prefixes = pressure === 'high' ? ['停一下。', '先别继续铺垫。', '我可能会划走。'] : pressure === 'low' ? ['我在听。', '可以继续。'] : ['我有一个具体疑问。'];
    return {
      profileId: profile.id,
      who: profile.name,
      signal,
      reason: signal === 'continue' ? profile.motivation : `触发信号：${signal}`,
      text: `${prefixes[eventIndex % prefixes.length]}${text}`
    };
  }

  function getTemplate(id) { return templates.find(template => template.id === id) || templates[0]; }
  function getProfiles(template, limit = 3) { return template.audiences.slice(0, limit).map(id => profiles[id]); }

  window.CreatorAudienceEngine = { templates, profiles, getTemplate, getProfiles, observe, nextReaction };
})();
