FROM public.ecr.aws/amazonlinux/amazonlinux:latest

WORKDIR /app

COPY . /app

RUN yum update -y && \
  yum install -y python3 python3-devel && \
  pip3 install --upgrade pip && \
  pip3 install pipenv

RUN pipenv --python 3 && \
  pipenv sync

EXPOSE 80

CMD ["pipenv", "run", "python3", "app.py"]