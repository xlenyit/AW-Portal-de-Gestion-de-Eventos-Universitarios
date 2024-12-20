'use strict';

var express = require('express');
var router = express.Router();
const DAO = require('../public/javascripts/DAO')
const midao = new DAO('localhost','root','','aw_24');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const sqlInjectionCheckMiddleware = (request, res, next) => {
  // Expresión regular para detectar patrones comunes de inyección SQL
  // const sqlInjectionPattern = /(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|FROM|WHERE|--|#|\/\*|\*\/)/;
  const sqlInjectionPattern = /^(['";])(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|FROM|WHERE)/i;

  // Verificar cada campo en request.body
  for (const key in request.body) {
    if (request.body.hasOwnProperty(key)) {
      const value = request.body[key];

      if (sqlInjectionPattern.test(value)) {
        const ip = request.ip;
        midao.banear(ip);
        return response.redirect('/errors/banned');
      }
    }
  }

  
  next();
};

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
      user: 'bot.aw.eventos36@gmail.com',  
      pass: 'Contrasena_2024'   
  }
});


const passLocals = (req, res, next) => {
  res.locals.user = req.session.user;
  next();
};
router.use(passLocals)

const alreadyLoggedIn = (request, response, next) => { //Middleware que asegura de que los usuarios no loggeados no puedan acceder a las páginas de login o registro. Si un usuario ya está loggeado, lo redirige al inicio
  if (request.session.user === undefined) return next();
  response.redirect('/');
};

const isLoggedIn = (req, res, next) => { //Middleware que asegura de que solo los usuarios loggeados puedan acceder a ciertas páginas (como el perfil de usuario). Si el usuario no está loggeado, lo redirige a la página de login.
  if (req.session.user) return next();
  res.redirect('/users/login');
};



/* GET users listing. */
router.get('/', function(request, response, next) {
  response.send('respond with a resource');
});

// REGISTRO
//Renderiza pagina de register
router.get('/register', alreadyLoggedIn ,(request, response) => {
  midao.getFacultades((err,resultado)=> {
    if(err) console.err('Error: ', err)
    else response.render('register', {facultades:resultado});
  })
});

/* GET users listing. */
router.get('/cambiarContrasena', function(request, response, next) {
  response.render('cambiarContrasena');
});

// Ruta para verificar el correo
router.post('/verifyEmail', (req, res) => {
  const email = req.body.email;

  midao.getEmails((err, emails) => {
    if (err) {
      return res.status(500).send({ message: 'Error al acceder a los correos.' });
    }

    // Buscar el correo en la base de datos
    for (let i = 0; i < emails.length; i++) {
      if (email == emails[i].correo) {
        // Generar el código de verificación
        let clave = '' + Math.floor(Math.random() * 900 - 1 + 100) + '-' + Math.floor(Math.random() * 900 - 1 + 100);

        // Configurar Nodemailer
        const mailOptions = {
          from: 'bot.aw.eventos36@gmail.com',
          to: email,
          subject: 'Código de verificación para cambiar la contraseña',
          text: `Tu código de verificación es: ${clave}`
        };

        // Enviar el correo
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log(error)
            return res.status(500).json({ message: 'Error al enviar el correo.' });
          }

          // Solo enviar la respuesta una vez
          return res.status(200).json({ message: 'Revise su bandeja de entrada' });
        });

        // Si encontramos el correo, retornamos inmediatamente
        return;
      }
    }

    // Si no se encontró el correo en la base de datos
    return res.status(400).json({ message: 'Correo no válido' });
  });
});




// Maneja el registro
router.post('/register', sqlInjectionCheckMiddleware, checkValidity, async (request, response) => {
  const user = request.body;

  
  // Encriptar la contraseña
  const hashedPassword = await bcrypt.hash(user.contrasenaConf, 10);
  user.contrasena = hashedPassword;
  user.contrasenaConf = hashedPassword;
  // Llama al método para registrar al usuario
  midao.registerUser(user, (err, id) => {
    // if (err) return response.status(400).send(err);
    if (err) response.render('errors', {err_name: '420', err_message: 'Error al registrar el nuevo usuario'})
    // Conseguir el ID del usuario recién registrado
    // midao.getIdFromEmail(user.email, (err, id) => { //no hace falta 
    //   if (err) return response.status(400).send('Error al obtener ID');
      
      // Establece la sesión para el usuario recién registrado
      request.session.user = id;
      
      // Redirige a  home si el registro fue exitoso
      return response.redirect('/');
    });
  });

  

//LOGIN
router.get('/login', alreadyLoggedIn, (request, response) => {//Renderiza pagina de login
  response.render('login');
})

// Middelware para el post de login
router.post('/login', sqlInjectionCheckMiddleware,async function (request, response) {//Inicia sesion
  const { email, contrasena } = request.body;

  // Conseguir la contraseña e ID relacionada con el email
  midao.getIdAndPasswordFromEmail(email, (err, data) => {
    if (err ) return response.render('login', { error: 'Email incorrecto', correo: email });
    else if(!data) return response.render('login', { error: 'El email no está registrado', correo: email });

    bcrypt.compare(contrasena, data.contrasena, (err, isMatch) => {
      if (err)  throw(err);
      if (isMatch) {
        request.session.user = data.id;
        response.locals.user = data.id;
        return response.status(200).redirect('/');
      } 
      return response.render('login', { error: 'Contraseña incorrecta', correo: email });
    });
    
  })
});


function checkValidity(request, response, next){
  const user = request.body;
  // Aqui hay que mirar que los valores sean correctos
  if (user.contrasena !== user.contrasenaConf)
      return response.status(400).send('Las contraseñas han de coincidir')

  next();
}
//LOGOUT
router.get("/logout", isLoggedIn, (request, response) => { //Redirige a pagina principal, cerrando sesion en locals y session
  request.session.destroy()
  response.locals.user = request.session
  response.status(200)
  response.redirect('/');
})

//Profile
router.get('/profile',isLoggedIn, (request, response) => {
  midao.getUserById(request.session.user,(err,usuario)=> {
    if (err || !usuario) return response.status(400).send('No hay sesion iniciada');
    else{
      if (usuario.es_organizador === 0) {
        midao.getEventsEnrolledByUser(request.session.user,(err,resultado)=> {
          if (err || !resultado) return response.status(400).send('Error al buscar eventos a los que se ha inscrito el usuario');
          else response.render('profile', {usuario, eventos:resultado});
        })
      } else{
        midao.getEventsCreatedByUser(request.session.user,(err,resultado)=> {
          if (err || !resultado) return response.status(400).send('Error al buscar eventos que ha creado el usuario');
          else response.render('profile', {usuario, eventos :resultado});
        })
      }
    } 
  })
});

router.post('/modifyUser',sqlInjectionCheckMiddleware, async (request, response) => {
  let completed = 0;
  const { nombre, correo, telefono,facultad, rol} = request.body;

  let validValuesCode = areValidValues(correo, telefono); 
  if(validValuesCode !== 200)
    return response.status(validValuesCode).render('profile', {usuario:request.session.user, eventos: []});;

  midao.checkUniqueUserPhone(telefono, async (err, found) =>{
    if (err) return response.status(400).send('Error de acceso a la BD');
    midao.getUserTelephone(request.session.user, (err, telephone) =>{
      if (found === 1 && telephone != telefono)return response.status(202).render('profile', {usuario:request.session.user, eventos: []});
      completed++;
      carryOn();
    });
  });

  midao.checkUniqueUserEmail(correo, async (err, found) =>{
    if (err) return response.status(400).send('Error de Acceso a la BD');
    midao.getUserEmail(request.session.user, (err, email) =>{
      if (found === 1 && email != correo)return response.status(201).render('profile', {usuario:request.session.user, eventos: []});
      completed++;
      carryOn();
    });
  });

  const carryOn = () => {
    if (completed == 2){
    midao.modifyUser(nombre, correo, telefono, facultad, rol, request.session.user  ,(err,resultado)=> {
    if (err || !resultado) return response.status(400).send('No hay sesion iniciada');
    else{
      if (rol === 0) {
        midao.getEventsEnrolledByUser(request.session.user,(err,res)=> {
          if (err || !res) return response.status(400).send('Error al buscar eventos a los que se ha inscrito el usuario');
          else response.status(200).render('profile', {usuario:resultado, eventos:res});
        })
      } else{
        midao.getEventsCreatedByUser(request.session.user,(err,res)=> {
          if (err || !res) return response.status(400).send('Error al buscar eventos que ha creado el usuario');
          else response.status(200).render('profile', {usuario:resultado, eventos :res});
        })
      }
    } 
  })
    }}
});

function areValidValues(correo, telefono){
  const regexEmail = /[a-zA-Z0-9]+@[a-zA-Z0-9]+\.(?:com|es|net|io)/;
  const regexTelephone = /[0-9]{9}/;
  if (!regexEmail.test(correo)) return 203;
  if (!regexTelephone.test(telefono)) return 204;
  return 200;
}
router.post('/changePassword', sqlInjectionCheckMiddleware, (request, response) => {
  const { newPassword, email } = request.body; // Recibe la nueva contraseña

  
  if (!newPassword || newPassword.length < 6) {
      return response.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  // Cifrar la nueva contraseña con bcrypt
  bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
      if (err) {
          console.error('Error al cifrar la contraseña', err);
          return response.status(500).json({ message: 'Error al cifrar la contraseña' });
      }

      console.log(newPassword,hashedPassword )
      const userId = request.session.user; 
      midao.updatePassword(email, hashedPassword, (err, result) => {
          if (err) {
              console.error('Error al actualizar la contraseña', err);
              return response.status(500).json({ message: 'Error al actualizar la contraseña' });
          }

          // Respuesta exitosa
          return response.status(200).json({ message: 'Contraseña actualizada correctamente.' });
      });
  });
});
router.get('/getFacultades', (req, res) => {
  midao.getFacultades((err, facultades) => {
      if (err) {
          return res.status(500).json({ error: 'Error al obtener facultades' });
      }
      res.json({ facultades });
  });
});


module.exports = router;

