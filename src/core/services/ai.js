// language: JavaScript, file: src/core/services/ai.js
// Optional drafting assistance. Talks to any OpenAI-compatible /chat/completions
// endpoint, so free tiers (Groq, OpenRouter, Gemini, Mistral, Cerebras) and
// local runtimes (Ollama, LM Studio) all work through one code path.
'use strict';

const CATALOG = [
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
    free: true,
    note: 'Palier gratuit genereux, reponses tres rapides.'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    keyUrl: 'https://openrouter.ai/keys',
    free: true,
    note: 'Modeles suffixes :free gratuits, un seul endpoint pour tout.'
  },
  {
    id: 'gemini',
    label: 'Google AI Studio',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    free: true,
    note: 'Palier gratuit via l\'endpoint compatible OpenAI.'
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    keyUrl: 'https://console.mistral.ai/api-keys',
    free: true,
    note: 'Palier experimental gratuit, bon en francais.'
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    model: 'llama3.1-8b',
    keyUrl: 'https://cloud.cerebras.ai/',
    free: true,
    note: 'Palier gratuit, inference tres rapide.'
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'llama3.2',
    keyUrl: 'https://ollama.com/download',
    free: true,
    local: true,
    note: 'Aucune cle, aucune donnee ne quitte la machine.'
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: 'local-model',
    keyUrl: 'https://lmstudio.ai/',
    free: true,
    local: true,
    note: 'Serveur local compatible OpenAI.'
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    free: false,
    note: 'Payant a l\'usage.'
  },
  {
    id: 'custom',
    label: 'Endpoint personnalise',
    baseUrl: '',
    model: '',
    keyUrl: '',
    free: false,
    note: 'N\'importe quel serveur /chat/completions.'
  }
];

const SYSTEM = `Tu rediges des e-mails professionnels prets a envoyer.
Reponds UNIQUEMENT avec un objet JSON valide, sans texte autour, de la forme :
{"subject": "...", "html": "...", "text": "...", "notes": "..."}
Regles :
- "html" est un fragment HTML simple (p, br, ul, li, strong, a) sans balise <html>, <head> ni <body>.
- "text" est la version texte brut equivalente, lignes courtes.
- Ne mets aucun placeholder non rempli du type [Votre nom] sauf si l'utilisateur en fournit un.
- Pas de promesse commerciale mensongere, pas de fausse urgence.`;

function buildUserPrompt({ brief, language, tone, length, context, senderName }) {
  const lengths = {
    court: '3 a 5 phrases',
    moyen: '2 a 3 paragraphes courts',
    long: '4 paragraphes, dont un detaille',
    treslong: '5 paragraphes et plus, tres detaille'
  };
  const parts = [
    `Langue de redaction: ${language}.`,
    `Ton: ${tone}.`,
    `Longueur visee: ${lengths[length] || lengths.moyen}.`,
    senderName ? `Expediteur signataire: ${senderName}.` : '',
    context ? `Contexte / elements impose: ${context}` : '',
    `Objet du message: ${brief}`
  ];
  return parts.filter(Boolean).join('\n');
}

function resolveProvider(store, id) {
  const configured = store.get('ai.providers', []) || [];
  const own = configured.find((provider) => provider.id === id);
  const base = CATALOG.find((provider) => provider.id === id);
  if (!own && !base) throw new Error(`Fournisseur IA inconnu: ${id}`);
  return { ...base, ...own, key: own?.apiKey || '' };
}

function extractJson(text) {
  const cleaned = String(text || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = /\{[\s\S]*\}/.exec(cleaned);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

class AiWriter {
  constructor(store) {
    this.store = store;
  }

  catalog() {
    const configured = this.store.get('ai.providers', []) || [];
    return CATALOG.map((entry) => {
      const saved = configured.find((item) => item.id === entry.id) || {};
      return {
        ...entry,
        model: saved.model || entry.model,
        baseUrl: saved.baseUrl || entry.baseUrl,
        configured: Boolean(saved.apiKey),
        enabled: saved.enabled !== false
      };
    });
  }

  async draft({
    providerId,
    brief,
    language,
    tone,
    length,
    context,
    senderName,
    apiKey,
    model,
    baseUrl,
    temperature = 0.7
  }) {
    const provider = resolveProvider(this.store, providerId || this.store.get('ai.activeProviderId', 'groq'));
    const key = apiKey || provider.key || provider.apiKey || '';
    if (!provider.local && !key) {
      throw new Error(`Aucune cle API pour ${provider.label}. Ajoutez-la dans Parametres > Redaction IA.`);
    }
    const endpoint = `${(baseUrl || provider.baseUrl || '').replace(/\/$/, '')}/chat/completions`;
    if (!/^https?:\/\//.test(endpoint)) throw new Error('URL de base invalide.');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
          ...(providerId === 'openrouter'
            ? { 'HTTP-Referer': 'https://github.com/cameleonnbss', 'X-Title': 'MailForge' }
            : {})
        },
        body: JSON.stringify({
          model: model || provider.model,
          temperature,
          messages: [
            { role: 'system', content: SYSTEM },
            {
              role: 'user',
              content: buildUserPrompt({
                brief,
                language: language || this.store.get('ai.language', 'fr'),
                tone: tone || this.store.get('ai.tone', 'professionnel'),
                length: length || this.store.get('ai.length', 'moyen'),
                context: [context, this.store.get('ai.customInstructions', '')].filter(Boolean).join('\n'),
                senderName
              })
            }
          ]
        })
      });
    } catch (error) {
      clearTimeout(timer);
      if (error.name === 'AbortError') throw new Error('Delai depasse (90 s). Le fournisseur ne repond pas.');
      throw new Error(`Reseau injoignable: ${error.message}`);
    }
    clearTimeout(timer);

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} — ${raw.slice(0, 300)}`);
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error('Reponse non JSON du fournisseur.');
    }
    const content = payload.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);
    const usage = payload.usage || null;
    if (!parsed) {
      return { ok: true, subject: '', html: '', text: content, notes: 'Reponse non structuree du modele.', usage, provider: provider.label };
    }
    this.store.log('success', `Brouillon genere via ${provider.label} (${model || provider.model})`, { scope: 'ai' });
    return {
      ok: true,
      subject: parsed.subject || '',
      html: parsed.html || '',
      text: parsed.text || '',
      notes: parsed.notes || '',
      usage,
      provider: provider.label,
      model: model || provider.model
    };
  }

  async test(providerId, overrides = {}) {
    const started = Date.now();
    const provider = resolveProvider(this.store, providerId);
    const endpoint = `${(overrides.baseUrl || provider.baseUrl || '').replace(/\/$/, '')}/models`;
    try {
      const response = await fetch(endpoint, {
        headers: (overrides.apiKey || provider.key) ? { Authorization: `Bearer ${overrides.apiKey || provider.key}` } : {}
      });
      const body = await response.text();
      return {
        ok: response.ok,
        ms: Date.now() - started,
        message: response.ok
          ? `${provider.label} repond (${(JSON.parse(body).data || []).length} modeles listes).`
          : `HTTP ${response.status} — ${body.slice(0, 200)}`
      };
    } catch (error) {
      return { ok: false, ms: Date.now() - started, message: `${provider.label} injoignable: ${error.message}` };
    }
  }
}

module.exports = { AiWriter, CATALOG };
