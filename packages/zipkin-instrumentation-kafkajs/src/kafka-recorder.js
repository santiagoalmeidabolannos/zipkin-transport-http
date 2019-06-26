const {TraceId, option: {fromNullable}, Annotation, HttpHeaders} = require('zipkin');

const recordConsumeStart = (tracer, {topic, partition, message}) => {
  const traceId = message.headers[HttpHeaders.TraceId];
  const spanId = message.headers[HttpHeaders.SpanId];
  let id;

  if (traceId && spanId) {
    const parentId = message.headers[HttpHeaders.ParentSpanId];
    const sampled = message.headers[HttpHeaders.Sampled];
    const flags = message.headers[HttpHeaders.Flags];

    // TODO: this should definitely note join. It should make a child
    id = tracer.join(new TraceId({
      traceId,
      parentId: fromNullable(parentId),
      spanId,
      sampled: fromNullable(sampled),
      debug: flags ? parseInt(flags) === 1 : false
    }));
  } else {
    id = tracer.createRootId();
  }

  tracer.setId(id);
  tracer.recordServiceName(tracer.localEndpoint.serviceName);
  tracer.recordRpc('consume');
  tracer.recordBinary('kafka.topic', topic);
  tracer.recordBinary('kafka.partition', partition);
  tracer.recordAnnotation(new Annotation.ConsumerStart());
  return id;
};

const recordConsumeStop = (tracer, id, error) => {
  tracer.letId(id, () => {
    if (error) {
      tracer.recordBinary('error', error.toString());
    }
    tracer.recordAnnotation(new Annotation.ConsumerStop());
  });
};

const recordProducerStart = (tracer, remoteServiceName, {topic}) => {
  tracer.setId(tracer.createChildId());
  const traceId = tracer.id;
  tracer.recordServiceName(remoteServiceName);
  tracer.recordRpc('produce');
  tracer.recordBinary('kafka.topic', topic);
  tracer.recordAnnotation(new Annotation.ProducerStart());
  tracer.recordAnnotation(new Annotation.ServerAddr({
    serviceName: remoteServiceName
  }));
  return traceId;
};

const recordProducerStop = (tracer, id, error) => {
  tracer.letId(id, () => {
    if (error) {
      tracer.recordBinary('error', error.toString());
    }
    tracer.recordAnnotation(new Annotation.ProducerStop());
  });
};

module.exports = {
  recordConsumeStart,
  recordConsumeStop,
  recordProducerStart,
  recordProducerStop
};
