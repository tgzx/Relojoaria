import test from "node:test";
import assert from "node:assert/strict";
import {ensureProductIdentifiers} from "../js/utils.js";

const tokenA = "abcdef0123456789";
const tokenB = "fedcba9876543210";

test("slug legível, normalizado e SKU gerados com mesmo token seguro", () => {
  assert.deepEqual(ensureProductIdentifiers({name:"  Orient Elegância Cronô! "},()=>tokenA),{
    slug:"orient-elegancia-crono-abcdef0123456789",
    sku:"JG-ABCDEF0123456789"
  });
});

test("dois produtos de mesmo nome recebem identificadores distintos",()=>{
  const one=ensureProductIdentifiers({name:"Orient Elegance Crono"},()=>tokenA);
  const two=ensureProductIdentifiers({name:"Orient Elegance Crono"},()=>tokenB);
  assert.notEqual(one.slug,two.slug);
  assert.notEqual(one.sku,two.sku);
});

test("id existente não muda ao renomear e não precisa de RNG",()=>{
  let calls=0;
  assert.deepEqual(ensureProductIdentifiers({
    name:"Produto renomeado",slug:"produto-original-11",sku:"SKU-LEGADO"
  },()=>{calls++;return tokenA}),{slug:"produto-original-11",sku:"SKU-LEGADO"});
  assert.equal(calls,0);
});

test("legado sem SKU mantém slug e recebe SKU novo",()=>{
  assert.deepEqual(ensureProductIdentifiers({name:"Produto",slug:"antigo",sku:null},()=>tokenB),
    {slug:"antigo",sku:"JG-FEDCBA9876543210"});
});

test("legado sem slug mantém SKU e recebe slug novo",()=>{
  assert.deepEqual(ensureProductIdentifiers({name:"Produto",slug:"",sku:"REF-10"},()=>tokenB),
    {slug:"produto-fedcba9876543210",sku:"REF-10"});
});

test("tentativa novamente após erro reutiliza os valores gerados",()=>{
  const original={name:"Relógio",sku:"",slug:""};
  Object.assign(original,ensureProductIdentifiers(original,()=>tokenA));
  const retry=ensureProductIdentifiers(original,()=>{throw Error("Não deveria gerar novamente");});
  assert.deepEqual(retry,{slug:original.slug,sku:original.sku});
});

test("nome não romanizável usa prefixo de fallback sem gerar slug vazio",()=>{
  assert.equal(ensureProductIdentifiers({name:"時計"},()=>tokenA).slug,"produto-abcdef0123456789");
});

test("token inválido não gera identificador inseguro",()=>{
  assert.throws(()=>ensureProductIdentifiers({name:"Produto"},()=> "123"),/identificador seguro/);
  assert.throws(()=>ensureProductIdentifiers({name:"Produto"},()=> "000000000000000X"),/identificador seguro/);
});

test("sem mock, usa CSPRNG de 8 bytes com identificador de 16 hex",()=>{
  const a=ensureProductIdentifiers({name:"Orient"});
  const b=ensureProductIdentifiers({name:"Orient"});
  assert.match(a.slug,/^orient-[a-f0-9]{16}$/);
  assert.match(a.sku,/^JG-[A-F0-9]{16}$/);
  assert.notEqual(a.slug,b.slug);
});
