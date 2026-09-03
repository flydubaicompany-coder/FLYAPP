import { describe, expect, it } from 'vitest';
import { distanciaKm, rotuloDeDistancia, urlDeRota } from './rota';

const BURJ = { latitude: 25.1972, longitude: 55.2744 };
const MARINA = { latitude: 25.0805, longitude: 55.1403 };

describe('urlDeRota', () => {
  it('entrega ao app de mapas de cada plataforma', () => {
    expect(urlDeRota('ios', BURJ)).toBe('https://maps.apple.com/?daddr=25.1972,55.2744');
    expect(urlDeRota('android', BURJ)).toBe('geo:0,0?q=25.1972,55.2744');
    expect(urlDeRota('web', BURJ)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=25.1972,55.2744',
    );
  });

  it('leva o nome do lugar quando a plataforma aceita', () => {
    expect(urlDeRota('ios', BURJ, 'Base Fly')).toContain('&q=Base%20Fly');
    expect(urlDeRota('android', BURJ, 'Base Fly')).toContain('(Base%20Fly)');
  });

  // Plataforma desconhecida cai no HTTPS, que funciona em qualquer navegador.
  it('não deixa plataforma desconhecida sem rota', () => {
    expect(urlDeRota('windows', BURJ)).toMatch(/^https:\/\/www\.google\.com\/maps/);
  });
});

describe('distanciaKm', () => {
  it('mede em linha reta', () => {
    // Burj Khalifa até a Marina: ~17 km em linha reta.
    expect(distanciaKm(BURJ, MARINA)).toBeGreaterThan(15);
    expect(distanciaKm(BURJ, MARINA)).toBeLessThan(20);
  });

  it('é zero para o mesmo ponto', () => {
    expect(distanciaKm(BURJ, BURJ)).toBe(0);
  });
});

describe('rotuloDeDistancia', () => {
  it('vira metro abaixo de um quilômetro', () => {
    expect(rotuloDeDistancia(0.35)).toBe('350 m');
  });

  it('usa vírgula decimal', () => {
    expect(rotuloDeDistancia(1.24)).toBe('1,2 km');
  });

  it('arredonda o que já é longe', () => {
    expect(rotuloDeDistancia(14.4)).toBe('14 km');
  });
});
