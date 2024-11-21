'use strict';

var express = require('express');
var router = express.Router();
const DAO = require('../public/javascripts/DAO')
const midao = new DAO('localhost','root','','AW_24');

// EVENTO
router.get('/event',(request, response) => {//Renderiza pagina de register
    response.status(200)
    var config = {};
    let contador = 0;

    // Habría que cambiarlo para que funcionase en lugar de con isLogged, pasando un user.
    // Si user === null -> !isLogged
    // Si no, tomar valores desde user.hasNotification, user.esta_inscrito...
    config.isLogged = request.isLogged;
    config.hasNotification = request.hasNotification;
    config.usuario= { esta_inscrito: true, esta_lista_espera: true},
    config.image_path= '/img/placeholderEvento.jpg',
    config.image_alt= 'Imagen'

    midao.getEvento(1, (err,resultado)=> {
        if(err) console.error('Error: ', err)
        else{
            resultado = resultado[0];
            config.idEvento = resultado.id;
            config.nombre = resultado.titulo;
            config.fecha = resultado.fecha;
            config.precio= resultado.precio;
            config.hora= resultado.hora;
            config.ubicacion= resultado.ubicacion;
            config.capacidad_maxima= resultado.capacidad_maxima;
            config.descripcion = resultado.descripcion;
            config.ocupacion = resultado.ocupacion;

        };
        checkAndRender();
    });
    
    const checkAndRender = () =>{
        response.render('event', config);
    };


});

router.get('/eventViewer', (request, response) => {
    response.status(200);
    let config = {};
    let validados = 0;

    config.isLogged = true;
    config.hasNotification=true;


    calcularElementosParaFiltros((err, filtros) => {
        if (err) response.status(400);
        else{
            config.organizators = filtros.organizators;
            config.categories = filtros.categories;
            config.precio_maximo = filtros.precio_maximo;
        }
        validados++;
        tryRender();


    });

    obtenerConfiguracionDeEventos((err, eventos) => {
        if (err) response.status(400);
        else config.eventos = eventos;
        validados++;
        tryRender();
    });
    
    const tryRender = () => {
        if (validados === 2)
            response.render('eventViewer', config);
    }

});

/// Funciones Extra

function calcularElementosParaFiltros(callback){
    let config = {};
    let completed = 0;

    midao.getOrganizators((err, organizadores) =>{
        if (err){
            console.error('Error: ', err)
            checkout(err, null);
        } 
        else
            config.organizators = organizadores;

        completed++;
        checkAndRender();
        
    });

    midao.getCategories((err, categorias)=> {
        if (err){
            console.error('Error: ', err)
            checkout(err, null);
        } 
        else
            config.categories = categorias;

        completed++;
        checkAndRender();

    });

    midao.getMaxPrice((err, maxPrice) => {
        if (err){
            console.error('Error: ', err)
            callback(err, null);
        }
        else
            config.precio_maximo = maxPrice.maxPrice;

        completed++;
        checkAndRender();
    })

    const checkAndRender = () => {
        if (completed === 3) 
            callback(null, config);
    }; 

}

function obtenerConfiguracionDeEventos(callback){
    let todosLosEventos = [];

    midao.getEventos((err, eventos) => {
        if (err){
            console.error('Error: ', err)
            callback(err, null);
        }
        else{
            for (let i = 0; i < eventos.length; i++){
                todosLosEventos.push(eventos[i]);
            }

            callback(null, todosLosEventos)
        }


    });
}


module.exports = router;