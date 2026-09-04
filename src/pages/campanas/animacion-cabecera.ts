/**
 * Animaciones que encabezan los correos de campañas.
 *
 * Van como GIF y no como Lottie porque los clientes de correo no ejecutan JavaScript, y se
 * sirven por URL en vez de incrustadas: como adjunto en línea (`multipart/related` +
 * `Content-ID`) el archivo llegaba byte por byte idéntico y el decodificador del sistema lo
 * leía bien, pero Gmail mostraba el ícono de imagen rota. Servidas por URL, Gmail las pasa
 * por su proxy —que sí anima GIFs— y el problema desaparece.
 *
 * Los archivos viven en `public/correo/` y los publica el mismo `deploy-pages.sh` del panel.
 *
 * El nombre de cada archivo lleva versión a propósito: Gmail cachea las imágenes por URL en
 * su proxy, así que republicar el mismo nombre dejaría a los destinatarios viendo la versión
 * anterior. Al cambiar una animación se sube un archivo nuevo y se apunta acá; el viejo se
 * queda donde está porque los correos ya enviados lo siguen pidiendo.
 *
 * Ojo: si alguna vez cambia el dominio de GitHub Pages hay que actualizar estas URLs,
 * porque los correos ya enviados seguirán apuntando al viejo.
 */

const BASE = 'https://salvaradoh.github.io/panel-comercial/correo';

export interface Animacion {
  url: string;
  /** Tamaño del archivo, que es también el tamaño al que se muestra: nunca se estira. */
  ancho: number;
  alto: number;
  /** Aire que agrega el correo arriba, según cuánto margen traiga ya el propio archivo. */
  rellenoArriba: number;
  /** Lo que se lee si el cliente bloquea imágenes. */
  alt: string;
}

/**
 * Cabecera del correo de campaña: cohete, dona y gráficos en 3D.
 *
 * No es el GIF que se baja de LottieFiles —ese mide 150x142 y agrandarlo quedaba borroso—
 * sino un render propio desde el JSON de la animación, que tiene lienzo de 1000x949 y PNG
 * internos de hasta 923x724. Se genera con `render-marketing.cjs` + `armar-gif-ppm.py` y va
 * recortado al contenido (x 47-907, y 74-849 del lienzo), que lo hace ver más grande sin
 * ocupar más lugar. Va a 15 fps en vez de 29 porque a 29 pesaba 2,4 MB.
 *
 * Trae una marca de agua "Viral" del autor original (Daniel Oliveira - Viral Methods) abajo
 * a la derecha; a este tamaño se alcanza a leer.
 */
export const CAMPANA: Animacion = {
  url: `${BASE}/campaign-v3.gif`,
  ancho: 300,
  alto: 270,
  rellenoArriba: 26,
  alt: 'Nueva campaña',
};

/**
 * Cabecera del correo con las cuentas seleccionadas: una ventana que se va llenando de
 * fichas de clientes.
 *
 * De esta animación solo tenemos el GIF que bajó Samuel (150x84), no su JSON, así que no se
 * puede re-renderizar con más detalle del que ya trae. `aplanar-gif-sobre-blanco.py` lo
 * aplana sobre blanco, le recorta el aire y lo agranda 2x, con un realce de borde suave.
 *
 * El 2x no es arbitrario: es arte de líneas duras, que interpolado se ve borroso y con
 * realce fuerte se ve escalonado. Se probó 1x, 1,6x, 2x y 2,8x; de 2x para arriba aparecen
 * los escalones. Por eso esta cabecera es más chica que la de campaña (300x270): más vale
 * chica y nítida que grande y sucia.
 *
 * La solución de fondo es conseguir el JSON de esta animación en LottieFiles y renderizarla
 * como la de campaña, que sí sale de su Lottie y por eso aguanta 300 px.
 */
export const CLIENTES: Animacion = {
  url: `${BASE}/clients-v3.gif`,
  ancho: 214,
  alto: 132,
  rellenoArriba: 30,
  alt: 'Cuentas seleccionadas',
};
