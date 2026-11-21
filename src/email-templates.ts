// Booking confirmation email (success only), ported from imjorgemor/sunnyproject
// apps/bot/src/email-templates.ts: club-styled HTML (logo header, hero image, Spanish
// "Estimado socio…" body, social-icon footer) plus a plain-text version.

const CLUB_LOGO_HEADER = "http://clubmetropolitan.net/img/mailing/logo-header.jpg";
const CLUB_HERO =
  "https://clubmetropolitan.net/files/fitxers/view/a2472a90f0ad195237902b68b7b865b5.jpg";
const CLUB_LOGO_FOOTER = "http://clubmetropolitan.net/img/mailing/logo-footer.png";
const CLUB_FACEBOOK = "http://clubmetropolitan.net/img/mailing/facebook-bottom.png";
const CLUB_TWITTER = "http://clubmetropolitan.net/img/mailing/twitter-bottom.png";
const CLUB_YOUTUBE = "http://clubmetropolitan.net/img/mailing/youtube-bottom.png";
const CLUB_INSTAGRAM = "http://clubmetropolitan.net/img/mailing/instagram.png";

export type SuccessVars = {
  /** Cliente name: the sheet user's name ("jorge - 3" → "jorge"). */
  name: string;
  /** Court / pista label scraped from the booking page. */
  pista: string;
  /** Madrid-local DD/MM/YYYY for the booked day. */
  date: string;
  /** HH:MM hour slot. */
  hour: string;
};

export function htmlSuccessEmail({ name, pista, date, hour }: SuccessVars): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reserva confirmada</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff">
  <center>
    <table cellpadding="0" cellspacing="0" style="background-color:#fff">
      <tbody>
        <tr>
          <td width="780" style="margin:auto">
            <table style="margin:auto" cellpadding="0" cellspacing="0">
              <tbody>
                <tr>
                  <td style="padding:0">
                    <a href="http://www.clubmetropolitan.net/" target="_blank">
                      <img alt="Club Metropolitan" src="${CLUB_LOGO_HEADER}" style="display:block;border:0">
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0">
                    <img src="${CLUB_HERO}" width="780" style="display:block;border:0" alt="">
                  </td>
                </tr>
              </tbody>
            </table>
            <table style="padding-top:15px" width="100%">
              <tbody>
                <tr>
                  <td style="font-family:Arial;font-weight:normal;font-size:14px;color:#747474;text-align:center">
                    <p>Estimado socio,</p>
                    <p>Estos son los datos de su reserva:</p>
                    <p>&nbsp;</p>
                    <p style="margin-bottom:0">Cliente: ${name}</p>
                    <p style="margin-bottom:0">Actividad: <strong>PADEL</strong></p>
                    <p style="margin-bottom:0">Zona: ${pista}</p>
                    <p style="margin-bottom:0">Fecha: ${date}</p>
                    <p style="margin-bottom:0">Hora: ${hour}</p>
                    <p style="margin-bottom:0">Duración: 60 min</p>
                    <p>&nbsp;</p>
                    <p style="font-family:Arial;font-weight:normal;font-size:13px;letter-spacing:0;color:rgb(67,67,68);text-align:justify">
                      <span style="font-size:9px;color:#808080">La información contenida en este mensaje y/o archivo(s) adjunto(s), enviada desde METROPOLITAN SPAIN, SL es confidencial y está destinada a ser leída sólo por la(s) persona(s) a la(s) que va dirigida. Le recordamos que sus datos han sido incorporados al sistema de tratamiento de METROPOLITAN SPAIN, SL, con CIF B62936737 al ser proveedor, colaborador, socio, exsocio, cliente, preinscrito y/o habernos facilitado sus datos y haber aceptado en su momento la política de confidencialidad o protección de datos para poder conocer o usar nuestros Clubs, con la finalidad de remitirle comunicaciones de su interés.<br><br>Podrá ejercer sus derechos de acceso, rectificación, limitación de tratamiento, supresión, portabilidad y oposición/revocación, en los términos que establece la normativa vigente en materia de protección de datos, dirigiendo su petición a METROPOLITAN SPAIN, SL, C/ Galileo, 186, 08028-Barcelona o bien a través de correo electrónico a </span><a href="mailto:dpo@clubmetropolitan.net" style="text-decoration:none;color:#808080" target="_blank"><span style="text-decoration:none;color:#808080">dpo@clubmetropolitan.net</span></a>
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
            <table style="padding-top:15px">
              <tbody>
                <tr>
                  <td>
                    <table border="0" cellspacing="0" width="350">
                      <tbody>
                        <tr>
                          <td style="padding-left:23px;padding-bottom:3px">
                            <a href="http://www.clubmetropolitan.net/" target="_blank">
                              <img alt="Metropolitan" border="0" src="${CLUB_LOGO_FOOTER}" style="display:block;margin:0pt" width="206">
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td>
                    <table border="0" cellspacing="0" style="background-color:#fff" width="530">
                      <tbody>
                        <tr>
                          <td>
                            <table>
                              <tbody>
                                <tr>
                                  <td>
                                    <p style="font-family:Arial;font-weight:normal;font-size:13px;letter-spacing:2.4px;color:#747474;padding-left:30px">SÍGUENOS EN:</p>
                                  </td>
                                  <td style="padding-left:20px">
                                    <a href="http://www.facebook.com/clubmetropolitan" target="_blank">
                                      <img alt="Facebook" border="0" height="23" src="${CLUB_FACEBOOK}" style="display:inline-block">
                                    </a>
                                  </td>
                                  <td style="padding-left:20px">
                                    <a href="https://twitter.com/metropolitangym" target="_blank">
                                      <img alt="Twitter" border="0" height="23" src="${CLUB_TWITTER}" style="display:inline-block">
                                    </a>
                                  </td>
                                  <td style="padding-left:20px">
                                    <a href="http://www.youtube.com/clubmetropolitan" target="_blank">
                                      <img alt="YouTube" border="0" height="23" src="${CLUB_YOUTUBE}" style="display:inline-block">
                                    </a>
                                  </td>
                                  <td style="padding-left:20px">
                                    <a href="https://instagram.com/metropolitangym" target="_blank">
                                      <img alt="Instagram" border="0" height="35" src="${CLUB_INSTAGRAM}" style="display:inline-block">
                                    </a>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </center>
</body>
</html>`;
}

export function plainTextSuccessEmail({ name, pista, date, hour }: SuccessVars): string {
  return [
    "Estimado socio,",
    "",
    "Estos son los datos de su reserva:",
    "",
    `Cliente: ${name}`,
    `Actividad: PADEL`,
    `Zona: ${pista}`,
    `Fecha: ${date}`,
    `Hora: ${hour}`,
    `Duración: 60 min`,
  ].join("\n");
}

export function successSubject({ date, hour }: Pick<SuccessVars, "date" | "hour">): string {
  return `Reserva confirmada — ${date} ${hour}`;
}
