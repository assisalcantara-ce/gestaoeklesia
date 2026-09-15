export type CategoriaVideo = 'culto' | 'estudo' | 'evento' | 'musica' | 'outro';
export type LiveProvider = 'youtube' | 'vimeo' | 'facebook' | 'hls' | 'outro';

export const CATEGORIAS_MIDIA_VIDEO: readonly CategoriaVideo[] = [
  'culto',
  'estudo',
  'evento',
  'musica',
  'outro',
] as const;

export const CATEGORIA_LABELS: Record<CategoriaVideo, string> = {
  culto: 'Culto / Pregação',
  estudo: 'Estudo Bíblico',
  evento: 'Evento / Congresso',
  musica: 'Música / Louvor',
  outro: 'Outro',
};

export const LIVE_PROVIDERS: readonly LiveProvider[] = [
  'youtube',
  'vimeo',
  'facebook',
  'hls',
  'outro',
] as const;

export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();

  // youtube.com/watch?v=ID
  const matchWatch = cleanUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (matchWatch) return matchWatch[1];

  // youtu.be/ID
  const matchShort = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (matchShort) return matchShort[1];

  // youtube.com/embed/ID
  const matchEmbed = cleanUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (matchEmbed) return matchEmbed[1];

  // youtube.com/live/ID
  const matchLive = cleanUrl.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  if (matchLive) return matchLive[1];

  // Raw 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl;

  return null;
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function getYouTubeThumbnailUrl(
  videoId: string,
  quality: 'maxres' | 'sd' | 'mq' | 'hq' = 'hq'
): string {
  if (!videoId) return '';
  switch (quality) {
    case 'maxres':
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    case 'sd':
      return `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
    case 'mq':
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    case 'hq':
    default:
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
}

export function getYouTubeLiveEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`;
}

export function isValidVideoUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getSafeEmbedUrl(url: string, provider: string): string | null {
  if (!url) return null;

  if (provider === 'youtube') {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }

  if (provider === 'vimeo') {
    const match = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    if (match) {
      return `https://player.vimeo.com/video/${match[1]}`;
    }
  }

  if (provider === 'facebook') {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  }

  return null;
}

