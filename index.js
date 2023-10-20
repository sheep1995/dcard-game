require('dotenv').config()
const functions = require('@google-cloud/functions-framework');
const express = require('express');
const mysql = require('mysql');
const app = express();
const bodyParser = require('body-parser');
const connection = require('./database');

const pool = mysql.createPool({
    connectionLimit : 5,
    host: '34.81.64.187',//host internal ip
    port:'3306',
    user: 'test',
    password: process.env.DB_PASS,
    database: 'acme',
    //socketPath: `/cloudsql/my-project-2023-402413:asia-east1:acme-db`
});

functions.http('helloWorld', (req, res) => {
    pool.query(
        "SELECT * FROM `acme`.`warehouses` WHERE id = ?", req.query.id,
        (error, results, fields) => {
          if(error) throw error;
          res.json(results);
        }
    );
});

