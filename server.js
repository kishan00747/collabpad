const express = require('express');

const app = express();

app.get('/:id', (req, res) => {

    const id = req.params.id
    res.status(200).send(id);
});

app.listen(3002, () => {
    console.log("Server Running");
})