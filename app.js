const path = require('path');
require('dotenv').config({
    path: path.resolve(__dirname, `${process.env.NODE_ENV}.env`)
})
const express = require('express')
const cors = require('cors');
const bodyParser = require('body-parser');
const jwe = require('./jwe')
const app = express()
const port = 3000
const connection = require('./database');
const mysql = require('mysql2');
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
});
const promisePool = pool.promise();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const asyncHandler = fn => async(req, res, next) => {
    return Promise
        .resolve(fn(req, res, next))
        .catch(next);
};

app.get('', (req, res) => {
    res.send(`Dcard-game-server: ${process.env.NODE_ENV}`)
})

app.get('/login', asyncHandler(async(req, res) => {

    const user = req.query.user;
    if(!user){
        res.status(400).send({
            errorMessage: 'Missing parameters'
        })
        return 1;
    }
    
    let jweDecrypt;

    try {
        jweDecrypt = await jwe.decrypt(user);
    } catch (error) {
        res.status(403).send({
            errorMessage: 'Invalid token'
        })
        return 1;
    }
    
    const { memberId, exp} = jweDecrypt;

    if(memberId == undefined){
        res.status(403).send({
            errorMessage: 'Invalid token'
        })
        return 1;
    }
    if(exp<Math.floor(Date.now()/1000)){
        res.status(403).send({
            errorMessage: 'token expired'
        })
        return 1;
    }

    sql = "INSERT IGNORE INTO UserData VALUES (?, CURRENT_TIMESTAMP, 0, 0, 0, 0, 0);"
    await promisePool.query(sql, memberId);

    console.log('memberId', memberId);
    res.status(200).send({
        memberId: memberId
    })
    return 0;
    
}));

// 取得會員資料
app.get('/member/:memberId', asyncHandler(async(req, res) => {
    
    const memberId = req.params.memberId;
    const mode = req.query.mode;
    if(!memberId){
        res.status(400).send({
            errorMessage: 'Missing parameters'
        })
        return 1;
    }

    let response;

    let [rows1] = await promisePool.query(
        "SELECT * FROM UserData WHERE memberId = ?", memberId
    );
    if(rows1.length==0){
        res.status(401).send({
            errorMessage: 'the memberId not found'
        });
        return 1;
    }
    response = rows1[0];
    delete response.createTime;
    delete response.loginTime;

    if (mode == undefined){
        console.log(response);
        res.json(response);
        return 0
    }

    let sql;
    switch (mode) {
        case '1':
        case '2': {
            sql = "SELECT MAX(score) FROM GameRecord WHERE memberId = ? AND mode = ?"
            break;
        }
        case '3': {
            sql = "SELECT MIN(seconds) FROM GameRecord WHERE memberId = ? AND mode = ? AND score >= 2000;"
            break;
        }
        default: {
            break;
        }   
    }

    let [rows2] = await promisePool.query(sql, [memberId, mode]);
    if (Object.keys(rows2[0]).includes('MIN(seconds)')){
        response['bestScore'] = rows2[0]['MIN(seconds)'] || -1;
    } else {
        response['bestScore'] = rows2[0]['MAX(score)'] || -1;
    }
    console.log('userInfo', response);
    res.json(response);
}));


// 遊戲結算
app.post('/member/:memberId/gameSettle', asyncHandler(async(req, res) => {
    
    const memberId = req.params.memberId;
    const {coin, bomb, controller, slingshot, marble, score, time, mode} = req.body;
    if(!memberId){
        res.status(400).send({
            errorMessage: 'Missing parameters'
        })
        return 1;
    }

    let sql = `UPDATE UserData 
    SET 
      coin = CASE WHEN (coin + ?) > 0 THEN (coin + ?) ELSE 0 END,
      bomb = CASE WHEN (bomb + ?) > 0 THEN (bomb + ?) ELSE 0 END,
      controller = CASE WHEN (controller + ?) > 0 THEN (controller + ?) ELSE 0 END,
      slingshot = CASE WHEN (slingshot + ?) > 0 THEN (slingshot + ?) ELSE 0 END,
      marble = CASE WHEN (marble + ?) > 0 THEN (marble + ?) ELSE 0 END
    WHERE memberId = ?`
    let [rows] = await promisePool.query( sql, 
        [ coin, coin, bomb, bomb, controller, controller, 
          slingshot, slingshot, marble, marble, memberId ]);
    
    console.log('debug', rows);
    if(rows.affectedRows === 0){
        res.status(401).send({
            errorMessage: 'the memberId not found'
        })
        return 1;
    }

    const generateUniqueID = () => {
        const timestamp = new Date().getTime();
        const randomDigits = Math.floor(Math.random() * 1000000000);
        const uniqueID = `${String(timestamp).substring(3, 13)}${randomDigits.toString().padStart(9, '0')}`;
      
        return uniqueID;
    }
    const data = {
        roundId: generateUniqueID(),
        memberId: memberId,
        createTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
        mode: mode,
        score: score,
        seconds: time
    }
    await promisePool.query('INSERT INTO GameRecord SET ?', data)

    switch (mode) {
        case '1':
        case '2':
        case 1:
        case 2:{
            sql = `SELECT MAX(score) AS bestScore
            FROM GameRecord
            WHERE memberId = ?
            AND mode = ?`
            break;
        }

        case '3':
        case 3:{
            sql = `SELECT MIN(seconds) AS bestScore
            FROM GameRecord
            WHERE memberId = ?
            AND mode = ?
            AND score >= 2000`
            break;
        }
            
        default:
            break;
    }

    let [rows2] = await promisePool.query(sql, [memberId, mode]);
    console.log(rows2[0]);
    console.log('gameSettel', rows2[0].bestScore);
    res.status(200).json({ 
        bestScore: rows2[0].bestScore||-1
    });
    return 0;
}));

// 取得會員排行榜
app.get('/member/:memberId/ranking', asyncHandler(async(req, res) => {
    
    const memberId = req.params.memberId;

    if(!memberId){
        res.status(400).send({
            errorMessage: 'Missing parameters'
        })
        return 1;
    }

    const sql_mode1_rank = `WITH RankedScores AS (
        SELECT
          memberId,
          MAX(score) AS max_score,
          DENSE_RANK() OVER (ORDER BY MAX(score) DESC) AS user_rank
        FROM GameRecord
        WHERE mode = 1
        GROUP BY memberId
      )
    SELECT memberId, max_score, user_rank
    FROM RankedScores
    WHERE memberId = ?;`;

    const sql_mode2_rank = `WITH RankedScores AS (
        SELECT
          memberId,
          MAX(score) AS max_score,
          DENSE_RANK() OVER (ORDER BY MAX(score) DESC) AS user_rank
        FROM GameRecord
        WHERE mode = 2
        GROUP BY memberId
      )
    SELECT memberId, max_score, user_rank
    FROM RankedScores
    WHERE memberId = ?;`;

    const sql_mode3_rank = `WITH RankedScores AS (
        SELECT
          memberId,
          MIN(seconds) AS min_time,
          DENSE_RANK() OVER (ORDER BY MIN(seconds) ASC) AS user_rank
        FROM GameRecord
        WHERE mode = 3
        AND score >= 2000
        GROUP BY memberId
      )
    SELECT memberId, min_time, user_rank
    FROM RankedScores
    WHERE memberId = ?;`;
    
    const sql_allmode_averageTime = `
    SELECT mode, AVG(seconds) AS averageTime
    FROM GameRecord
    WHERE memberId = ?
    GROUP BY mode;`;

    const sql_allmode_playerTimes = `
    SELECT mode, COUNT(*) AS playTimes
    FROM GameRecord
    WHERE memberId = ?
    GROUP BY mode;`;

    let promiseArray = [];
    promiseArray.push(promisePool.query(sql_mode1_rank, [memberId]));
    promiseArray.push(promisePool.query(sql_mode2_rank, [memberId]));
    promiseArray.push(promisePool.query(sql_mode3_rank, [memberId]));
    promiseArray.push(promisePool.query(sql_allmode_averageTime, [memberId]));
    promiseArray.push(promisePool.query(sql_allmode_playerTimes, [memberId]));

    Promise.all(promiseArray)
    .then(results => {
        let [rows1] = results[0];
        let dataMode1 = {
            mode: 1,
            bestScore: rows1[0]==undefined? -1 : rows1[0].max_score,
            ranking: rows1[0]==undefined? -1 : rows1[0].user_rank
        }
        let [rows2] = results[1];
        let dataMode2 = {
            mode: 2,
            bestScore: rows2[0]==undefined? -1 : rows2[0].max_score,
            ranking: rows2[0]==undefined? -1 : rows2[0].user_rank
        }
        let [rows3] = results[2];
        let dataMode3 = {
            mode: 3,
            bestScore: rows3[0]==undefined? -1 : rows3[0].min_time,
            ranking: rows3[0]==undefined? -1 : rows3[0].user_rank
        }
        let [rows4] = results[3];
        const desiredModes = [1, 2, 3];
        const mappedRows4 = desiredModes.map((desiredMode) => {
            const foundItem = rows4.find((item) => item.mode === desiredMode);
            if (foundItem) {
              return foundItem;
            } else {
              return { mode: desiredMode, averageTime: '-1' };
            }
        });
        dataMode1.averageTime = parseInt(mappedRows4[0].averageTime)
        dataMode2.averageTime = parseInt(mappedRows4[1].averageTime)
        dataMode3.averageTime = parseInt(mappedRows4[2].averageTime)
        
        let [rows5] = results[4];
        const mappedRows5 = desiredModes.map((desiredMode) => {
            const foundItem = rows5.find((item) => item.mode === desiredMode);
            if (foundItem) {
              return foundItem;
            } else {
              return { mode: desiredMode, playTimes: -1 };
            }
        });
        dataMode1.playTimes = mappedRows5[0].playTimes
        dataMode2.playTimes = mappedRows5[1].playTimes
        dataMode3.playTimes = mappedRows5[2].playTimes
        let response = [dataMode1, dataMode2, dataMode3];
        console.log('All promises resolved:', rows5);
        console.log('ranking', response);
        res.status(200).json(response);
    })
    .catch(error => {
        console.error('At least one promise was rejected:', error);
        res.status(500).send({
            errorMessage: 'server error'
        })
        return 1;
    });
    
}));

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

app.use((err, req, res, next) => {
    // Handle the error
    console.error(err.stack);
  
    // Send an error response to the client
    res.status(500).json({ error: 'server error' });
  });