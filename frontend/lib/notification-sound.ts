/**
 * Serviço de notificação sonora
 * Gerencia a reprodução de sons de alerta no sistema
 */

class NotificationSoundService {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.5;

  constructor() {
    // Carrega preferências do localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notification_sound_enabled');
      this.isEnabled = saved !== 'false';

      const savedVolume = localStorage.getItem('notification_sound_volume');
      if (savedVolume) {
        this.volume = parseFloat(savedVolume);
      }
    }
  }

  /**
   * Inicializa o AudioContext (deve ser chamado após interação do usuário)
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Reproduz um som de notificação usando Web Audio API
   * Som de alerta tipo "ding" para transbordo
   */
  playTransbordoAlert(): void {
    if (!this.isEnabled || typeof window === 'undefined') return;

    try {
      const ctx = this.getAudioContext();

      // Cria oscilador para o som
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Som de alerta - duas notas
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
      oscillator.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1); // C#6
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2); // A5

      // Envelope de volume
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, ctx.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, ctx.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, ctx.currentTime + 0.12);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, ctx.currentTime + 0.2);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, ctx.currentTime + 0.22);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);

      oscillator.type = 'sine';
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);

      // Segundo toque após um pequeno delay
      setTimeout(() => {
        this.playSecondTone(ctx);
      }, 500);

    } catch (error) {
      console.warn('Não foi possível reproduzir som de notificação:', error);
    }
  }

  private playSecondTone(ctx: AudioContext): void {
    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(1108.73, ctx.currentTime); // C#6
      oscillator.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.15); // E6

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.25, ctx.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, ctx.currentTime + 0.15);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

      oscillator.type = 'sine';
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (error) {
      // Ignora erros no segundo toque
    }
  }

  /**
   * Reproduz som de nova mensagem (mais suave)
   */
  playNewMessageSound(): void {
    if (!this.isEnabled || typeof window === 'undefined') return;

    try {
      const ctx = this.getAudioContext();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Som suave de notificação
      oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.15, ctx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);

      oscillator.type = 'sine';
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (error) {
      console.warn('Não foi possível reproduzir som:', error);
    }
  }

  /**
   * Habilita/desabilita sons de notificação
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('notification_sound_enabled', String(enabled));
    }
  }

  /**
   * Define o volume (0 a 1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (typeof window !== 'undefined') {
      localStorage.setItem('notification_sound_volume', String(this.volume));
    }
  }

  /**
   * Retorna se os sons estão habilitados
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Retorna o volume atual
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Testa o som de transbordo (para configurações)
   */
  testTransbordoSound(): void {
    const wasEnabled = this.isEnabled;
    this.isEnabled = true;
    this.playTransbordoAlert();
    this.isEnabled = wasEnabled;
  }
}

// Singleton para uso em toda a aplicação
export const notificationSound = new NotificationSoundService();
