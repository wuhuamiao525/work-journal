/**
 * AI 总结路由 - 使用 GitHub Models API (兼容 OpenAI)
 * 端点: https://models.inference.ai.azure.com
 * 通过后端代理转发，保护 GITHUB_TOKEN 不暴露到前端
 */

const express = require('express');
const router = express.Router();

const GITHUB_MODELS_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';
const MODEL = 'gpt-4o-mini';

/**
 * POST /api/ai/summarize
 * Body: { content: string, type: 'daily' | 'weekly' | 'monthly' }
 */
router.post('/summarize', async (req, res) => {
  const { content, type = 'daily' } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: '内容不能为空' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: '服务器未配置 GITHUB_TOKEN，AI 功能不可用' });
  }

  const typeLabel = type === 'weekly' ? '周报' : type === 'monthly' ? '月报' : '每日工作日记';
  const systemPrompt = `你是一位专业的工作总结助手。请根据用户提供的${typeLabel}内容，提炼出简洁的工作总结。
要求：
1. 用条目形式列出主要工作内容（3-8条）
2. 指出关键进展和成果
3. 如有逾期或风险任务，单独列出提醒
4. 语言简洁专业，使用中文
5. 总结控制在 300 字以内`;

  try {
    const response = await fetch(GITHUB_MODELS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请总结以下${typeLabel}内容：\n\n${content}` },
        ],
        max_tokens: 600,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[AI] GitHub Models API error:', response.status, errText);
      return res.status(502).json({ error: `AI 服务返回错误: ${response.status}` });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || '';
    res.json({ summary });
  } catch (err) {
    console.error('[AI] 请求失败:', err);
    res.status(500).json({ error: 'AI 请求失败，请稍后重试' });
  }
});

module.exports = router;
