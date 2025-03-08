


const wallet = async(req,res)=>{
    try{
res.render('wallet')
    }
catch(error){
    console.error('Error retrieving cart data:', error);
    res.redirect('/pageNotFound');
}
}

module.exports={
    wallet
}