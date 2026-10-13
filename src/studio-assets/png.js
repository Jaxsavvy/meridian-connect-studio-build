'use strict';
const zlib = require('node:zlib');
const fail = () => { const error = new Error('CORRUPT_MEDIA'); error.code = 'CORRUPT_MEDIA'; throw error; };
const table = Array.from({length:256}, (_,n) => { let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0; });
function crc32(bytes) { let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0; }
function inspectPng(input, {maxPixels=64000000} = {}) {
  const bytes=Buffer.from(input);
  if(bytes.length<45 || bytes.length>128*1024*1024 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))fail();
  let offset=8, header=null, ended=false, seenData=false, dataEnded=false;const compressed=[];
  while(offset<bytes.length) {
    if(offset+12>bytes.length)fail();const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8); const end=offset+12+length;
    if(end>bytes.length || !/^[A-Za-z]{4}$/.test(type))fail();const data=bytes.subarray(offset+8,offset+8+length);
    if(crc32(bytes.subarray(offset+4,offset+8+length))!==bytes.readUInt32BE(offset+8+length))fail();
    if(!header && type!=='IHDR')fail();
    if(type==='IHDR') {
      if(header || length!==13)fail();const width=data.readUInt32BE(0),height=data.readUInt32BE(4),colorType=data[9],channels={0:1,2:3,4:2,6:4}[colorType];
      if(!width || !height || width*height>maxPixels || !channels || data[8]!==8 || data[10]!==0 || data[11]!==0 || data[12]!==0)fail();
      header={width,height,pixels:width*height,colorType,channels,mediaType:'image/png'};
    } else if(type==='IDAT') {if(dataEnded)fail();seenData=true;compressed.push(data);}
    else if(type==='IEND') {if(length || !seenData || end!==bytes.length)fail();ended=true;break;}
    else {
      if(seenData)dataEnded=true;
      if(type[0]===type[0].toUpperCase() && type!=='PLTE')fail();
      if(type==='PLTE' && (seenData || !length || length%3 || length>768 || [0,4].includes(header.colorType)))fail();
    }
    offset=end;
  }
  if(!ended || !header)fail();const rowBytes=header.width*header.channels, expected=(rowBytes+1)*header.height;let raw;
  try {raw=zlib.inflateSync(Buffer.concat(compressed),{maxOutputLength:expected});}catch {fail();}
  if(raw.length!==expected)fail();let previous=Buffer.alloc(rowBytes);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<header.height;y++) {
    const start=y*(rowBytes+1),filter=raw[start];if(filter>4)fail();const row=Buffer.from(raw.subarray(start+1,start+1+rowBytes));
    for(let x=0;x<rowBytes;x++){const a=x>=header.channels?row[x-header.channels]:0,b=previous[x],c=x>=header.channels?previous[x-header.channels]:0;row[x]=(row[x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}previous=row;
  }
  return header;
}
module.exports={inspectPng,crc32};
