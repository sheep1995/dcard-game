const jwe = require('./jwe')

async function a52(){
    const a = await jwe.decrypt('eyJhbGciOiJQQkVTMi1IUzI1NitBMTI4S1ciLCJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwicDJjIjoxMDAwMDAsInAycyI6IjQzNjQ3VGM1YV9QNnozMTBGWnpXS3cifQ.7MXehiPRxONas85OrdFNJ0h0eC1x1JgRC7eWXuKlIoZpMtuK4hlIZQ.PvdBhznkcvd80GXKoRl_Qg.xO8ZrCWPCa1uMwTk3nYUe_mcJIyRBSPUgrKkD3zOXazOFC-wXLRE7l0XYLJv5zuThSvIlKdPSyifMln5ZRJa7WSEGb8dBlI4L85UJZ4sJqQ.ghz6l2yXHdOt9JNy39lvmg');
    console.log(a);
}

try {
    a52();
} catch (error) {
    console.log('ERROR');
}
