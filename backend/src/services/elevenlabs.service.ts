import axios from 'axios';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

class ElevenLabsService {
  isConfigured(): boolean {
    return !!process.env.ELEVENLABS_API_KEY;
  }

  /**
   * Gera áudio a partir de texto usando ElevenLabs TTS.
   * @param text    - Texto a ser convertido
   * @param voiceId - ID da voz ElevenLabs
   * @param modelId - eleven_multilingual_v2 | eleven_turbo_v2_5
   * @returns Buffer MP3
   */
  async generateSpeech(
    text: string,
    voiceId: string = 'EXAVITQu4vr4xnSDxMaL',
    modelId: string = 'eleven_multilingual_v2',
  ): Promise<Buffer> {
    if (!text || text.trim().length === 0) {
      throw new Error('Texto para TTS não pode estar vazio');
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY não configurada nas variáveis de ambiente.');
    }

    try {
      const response = await axios.post(
        `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
        {
          text: text.trim(),
          model_id: modelId,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.80,
            style: 0.15,
            use_speaker_boost: true,
          },
        },
        {
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
          timeout: 40000,
        },
      );

      return Buffer.from(response.data);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message?: string };
      console.error('[ElevenLabs] ❌ Error generating speech:', err.message);

      if (err.response?.status === 401) throw new Error('ElevenLabs: API key inválida.');
      if (err.response?.status === 429) throw new Error('ElevenLabs: rate limit atingido. Tente novamente em instantes.');
      if (err.response?.status === 422) throw new Error('ElevenLabs: texto ou voz inválidos.');

      throw new Error(`Falha ao gerar áudio ElevenLabs: ${err.message}`);
    }
  }
}

export default new ElevenLabsService();
