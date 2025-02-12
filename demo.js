let arr = [1,2,3,4,5,6,7,8];

function check(callback,array){
    callback(array);
}

function largest(array){
    const result =array.reduce((acc,curr)=> acc>curr?acc:curr);
    return result;
}

console.log(check(largest,arr)); // 