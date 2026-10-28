import { NextRequest,NextResponse } from 'next/server';
import { XMLParser,XMLValidator } from 'fast-xml-parser';
import { getPaymentAttempt,attemptCredentials,settlePayment } from '@/lib/payments/service';
import { verifyJazzCash,jazzCashHash } from '@/lib/payments/providers';
import { paymentOrigin } from '@/lib/payments/endpoints';
import { readPaymentBody } from '@/lib/payments/http';
const namespace='https://nisaab360.app/jazzcash';
const parameters=['pp_Version','pp_TxnType','pp_MerchantID','pp_TxnRefNo','pp_Amount','pp_TxnCurrency','pp_ResponseCode','pp_ResponseMessage','pp_RetreivalReferenceNo','pp_SecureHash'];
const headers={'Content-Type':'text/xml; charset=utf-8','Cache-Control':'no-store'};
// Merchant-owned contract: register this WSDL with JazzCash during onboarding.
// No unsupported/unsigned notification can write to the fee ledger.
export async function GET() {
  const address=`${paymentOrigin()}/api/webhooks/jazzcash/soap`;
  const elements=parameters.map(name=>`<xsd:element name="${name}" type="xsd:string" minOccurs="0"/>`).join('');
  return new NextResponse(`<?xml version="1.0" encoding="utf-8"?><wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:tns="${namespace}" targetNamespace="${namespace}"><wsdl:types><xsd:schema targetNamespace="${namespace}" elementFormDefault="qualified"><xsd:element name="UpdatePaymentStatus"><xsd:complexType><xsd:sequence>${elements}</xsd:sequence></xsd:complexType></xsd:element><xsd:element name="UpdatePaymentStatusResponse"><xsd:complexType><xsd:sequence><xsd:element name="UpdatePaymentStatusResult" type="xsd:string"/></xsd:sequence></xsd:complexType></xsd:element></xsd:schema></wsdl:types><wsdl:message name="Request"><wsdl:part name="parameters" element="tns:UpdatePaymentStatus"/></wsdl:message><wsdl:message name="Response"><wsdl:part name="parameters" element="tns:UpdatePaymentStatusResponse"/></wsdl:message><wsdl:portType name="PaymentPort"><wsdl:operation name="UpdatePaymentStatus"><wsdl:input message="tns:Request"/><wsdl:output message="tns:Response"/></wsdl:operation></wsdl:portType><wsdl:binding name="PaymentBinding" type="tns:PaymentPort"><soap:binding transport="http://schemas.xmlsoap.org/soap/http" style="document"/><wsdl:operation name="UpdatePaymentStatus"><soap:operation soapAction="${namespace}/UpdatePaymentStatus"/><wsdl:input><soap:body use="literal"/></wsdl:input><wsdl:output><soap:body use="literal"/></wsdl:output></wsdl:operation></wsdl:binding><wsdl:service name="NisaabPaymentService"><wsdl:port name="PaymentPort" binding="tns:PaymentBinding"><soap:address location="${address}"/></wsdl:port></wsdl:service></wsdl:definitions>`,{headers});
}
export async function POST(req:NextRequest) {
  try {
    const xml=await readPaymentBody(req,32768);
    if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error('Invalid SOAP');
    const parser=new XMLParser({removeNSPrefix:true,ignoreAttributes:true,parseTagValue:false,trimValues:false,processEntities:false});
    const value=parser.parse(xml)?.Envelope?.Body?.UpdatePaymentStatus;
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid SOAP');
    const fields:Record<string,string>={};
    for(const [name,data] of Object.entries(value)) {
      if(!parameters.includes(name)||typeof data!=='string'||data.length>2048)throw Error('Invalid SOAP fields');fields[name]=data;
    }
    if(!/^[A-Za-z0-9]{1,20}$/.test(fields.pp_TxnRefNo||''))throw Error('Invalid reference');
    const attempt=await getPaymentAttempt(fields.pp_TxnRefNo);
    if(attempt.gateway!=='jazzcash')throw Error('Invalid provider');
    const credentials=attemptCredentials(attempt).credentials;
    await settlePayment(attempt.id,verifyJazzCash(fields,attempt,credentials));
    const message='Success'.padEnd(200,' '),code='000';
    const hash=jazzCashHash({pp_ResponseCode:code,pp_ResponseMessage:message},credentials.integritySalt);
    return new NextResponse(`<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><UpdatePaymentStatusResponse xmlns="${namespace}"><UpdatePaymentStatusResult>${code}${message}${hash}</UpdatePaymentStatusResult></UpdatePaymentStatusResponse></soap:Body></soap:Envelope>`,{headers});
  }catch {
    return new NextResponse('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultcode>soap:Client</faultcode><faultstring>Payment notification could not be verified</faultstring></soap:Fault></soap:Body></soap:Envelope>',{status:500,headers});
  }
}
