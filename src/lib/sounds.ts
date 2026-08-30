export type SoundType = 'move' | 'capture' | 'check' | 'castle' | 'gameStart' | 'gameEnd' | 'invalid';

interface SoundSettings {
  soundEnabled: boolean;
  soundVolume: number;
}

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;

function initAudio(volume: number) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  if (masterGain) {
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), audioContext.currentTime);
  }
}

function playTone(
  type: OscillatorType,
  freq: number | number[],
  duration: number,
  startTime: number,
  attack: number = 0.02
) {
  if (!audioContext || !masterGain) return;

  const frequencies = Array.isArray(freq) ? freq : [freq];
  
  frequencies.forEach(f => {
    const osc = audioContext!.createOscillator();
    const gain = audioContext!.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(f, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(1, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(masterGain!);

    osc.start(startTime);
    osc.stop(startTime + duration);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  });
}

export function playSound(type: SoundType, settings: SoundSettings) {
  if (!settings.soundEnabled) return;

  initAudio(settings.soundVolume);

  if (!audioContext) return;
  const now = audioContext.currentTime;

  switch (type) {
    case 'move':
      playTone('sine', 600, 0.08, now, 0.05);
      break;
    
    case 'capture':
      playTone('square', [200, 400], 0.1, now, 0.02);
      break;
    
    case 'check':
      playTone('triangle', 880, 0.12, now, 0.02);
      break;
    
    case 'castle':
      playTone('sine', 600, 0.08, now, 0.05);
      playTone('sine', 600, 0.08, now + 0.06, 0.05);
      break;
    
    case 'gameStart':
      // C5 (523.25), E5 (659.25), G5 (783.99)
      playTone('sine', 523.25, 0.08, now, 0.02);
      playTone('sine', 659.25, 0.08, now + 0.06, 0.02);
      playTone('sine', 783.99, 0.08, now + 0.12, 0.02);
      break;
    
    case 'gameEnd':
      // G5 (783.99), C5 (523.25)
      playTone('sine', 783.99, 0.12, now, 0.02);
      playTone('sine', 523.25, 0.12, now + 0.08, 0.02);
      break;
    
    case 'invalid':
      playTone('square', 200, 0.1, now, 0.02);
      break;
  }
}
