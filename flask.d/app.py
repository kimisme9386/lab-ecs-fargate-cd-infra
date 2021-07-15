from flask import Flask, jsonify, request

app = Flask(__name__)


@app.route('/', methods=['GET'])
def welcome():
    return 'Welcome to flask framework. Version:2'


@app.route('/hello', methods=['GET'])
def health_check():
    return 'It\'s version:2'


@app.route('/login', methods=['POST'])
def result():
    if request.form.get('data'):
        return request.form.get('data')
    else:
        return jsonify({"message": "ERROR: Unauthorized"}), 401


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=80)
